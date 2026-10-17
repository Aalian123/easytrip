import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VehicleStatus } from '@prisma/client';
import {
  ASSIGNMENT_OWNED_STATUSES,
  CreateVehicleInput,
  RentalRateInput,
  UpdateVehicleInput,
  VehicleQuery,
  calculateOilStatus,
} from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService } from '../../prisma/prisma.service';
import { HistoryService, SHOWN_VEHICLE_EVENTS } from '../history/history.service';
import { VehicleStatusService } from './vehicle-status.service';
import { SettingsService } from '../settings/settings.service';

const LIST_FIELDS = {
  id: true,
  registration: true,
  make: true,
  model: true,
  year: true,
  color: true,
  category: true,
  plateType: true,
  licenceClass: true,
  status: true,
  currentMileage: true,
  lastOilChangeMileage: true,
  oilChangeIntervalKm: true,
} as const;

@Injectable()
export class VehiclesService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
    private readonly status: VehicleStatusService,
    private readonly settings: SettingsService,
  ) {}

  async list(query: VehicleQuery) {
    const where: Prisma.VehicleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { registration: { contains: query.q, mode: 'insensitive' } },
              { make: { contains: query.q, mode: 'insensitive' } },
              { model: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.raw.vehicle.count({ where }),
      this.raw.vehicle.findMany({
        where,
        select: {
          ...LIST_FIELDS,
          assignments: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: {
              id: true,
              assignedAt: true,
              expectedReturnAt: true,
              rider: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { [query.sort]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const settings = await this.settings.get();

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      rows: rows.map((vehicle) => {
        const { assignments, ...rest } = vehicle;
        return {
          ...rest,
          currentAssignment: assignments[0] ?? null,
          oil: calculateOilStatus({
            currentMileage: vehicle.currentMileage,
            lastOilChangeMileage: vehicle.lastOilChangeMileage,
            oilChangeIntervalKm: vehicle.oilChangeIntervalKm,
            warnWithinKm: settings.oilWarnWithinKm,
          }),
        };
      }),
    };
  }

  /** Counts behind the fleet status bar on the dashboard (FR-02). */
  async availability() {
    const grouped = await this.raw.vehicle.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus = Object.fromEntries(
      Object.values(VehicleStatus).map((status) => [status, 0]),
    ) as Record<VehicleStatus, number>;

    for (const row of grouped) byStatus[row.status] = row._count._all;
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

    return { total, byStatus };
  }

  async get(id: string) {
    const settings = await this.settings.get();
    const vehicle = await this.raw.vehicle.findUnique({
      where: { id },
      include: {
        rentalRates: { orderBy: { effectiveFrom: 'desc' }, take: 10 },
        assignments: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            rider: { select: { id: true, fullName: true, contactNumber: true } },
            fuelCard: { select: { id: true, cardNumber: true, provider: true } },
          },
        },
        _count: { select: { assignments: true, accidents: true, damages: true, maintenance: true } },
      },
    });
    if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');

    // A rate can be entered ahead of the day it starts, so the newest row is not
    // necessarily the one in force. Rates are newest first.
    const now = new Date();
    const inForce = vehicle.rentalRates.filter((rate) => rate.effectiveFrom <= now);
    const scheduled = vehicle.rentalRates.filter((rate) => rate.effectiveFrom > now);

    const { assignments, ...rest } = vehicle;
    return {
      ...rest,
      currentAssignment: assignments[0] ?? null,
      currentRate: inForce[0] ?? null,
      upcomingRate: scheduled[scheduled.length - 1] ?? null,
      oil: calculateOilStatus({
        currentMileage: vehicle.currentMileage,
        lastOilChangeMileage: vehicle.lastOilChangeMileage,
        oilChangeIntervalKm: vehicle.oilChangeIntervalKm,
        warnWithinKm: settings.oilWarnWithinKm,
      }),
    };
  }

  async create(input: CreateVehicleInput) {
    const settings = await this.settings.get();
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          ...input,
          oilChangeIntervalKm: input.oilChangeIntervalKm ?? settings.defaultOilIntervalKm,
        },
      });
      await this.history.recordVehicleEvent(tx, {
        vehicleId: vehicle.id,
        type: 'VEHICLE_ADDED',
        summary: `${vehicle.make} ${vehicle.model} (${vehicle.registration}) added to the fleet`,
        payload: { registration: vehicle.registration, mileage: vehicle.currentMileage },
      });
      return vehicle;
    });
  }

  async update(id: string, input: UpdateVehicleInput) {
    await this.get(id);
    // Clearing the interval means "use the fleet default", the same as on create;
    // a null interval would silently stop oil tracking for this vehicle.
    const data =
      input.oilChangeIntervalKm === null
        ? { ...input, oilChangeIntervalKm: (await this.settings.get()).defaultOilIntervalKm }
        : input;
    return this.prisma.vehicle.update({ where: { id }, data });
  }

  /**
   * A status set by hand. "On the road" belongs to handovers and returns, so it
   * can be neither set nor left from here, or the vehicle and its assignment
   * would disagree.
   */
  async changeStatus(id: string, status: VehicleStatus, reason?: string | null) {
    if (ASSIGNMENT_OWNED_STATUSES.includes(status)) {
      throw new ConflictException('A vehicle goes on the road by assigning it to a rider.');
    }
    await this.prisma.$transaction(async (tx) => {
      const out = await tx.vehicleAssignment.findFirst({
        where: { vehicleId: id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (out) {
        throw new ConflictException('This vehicle is out with a rider. Record its return to change its status.');
      }
      await this.status.transition(tx, id, status, reason);
    });
    return this.get(id);
  }

  /** Rates are historised — saving new figures adds a row, it never edits one. */
  async setRate(vehicleId: string, input: RentalRateInput) {
    await this.get(vehicleId);
    return this.prisma.rentalRate.create({
      data: {
        vehicleId,
        dailyRate: new Prisma.Decimal(input.dailyRate),
        weeklyRate: input.weeklyRate != null ? new Prisma.Decimal(input.weeklyRate) : null,
        monthlyRate: input.monthlyRate != null ? new Prisma.Decimal(input.monthlyRate) : null,
        securityDeposit: input.securityDeposit != null ? new Prisma.Decimal(input.securityDeposit) : null,
        lateReturnFeePerDay:
          input.lateReturnFeePerDay != null ? new Prisma.Decimal(input.lateReturnFeePerDay) : null,
        effectiveFrom: input.effectiveFrom,
      },
    });
  }

  /** The permanent timeline (FR-07), newest first. */
  async timeline(vehicleId: string, take = 200) {
    await this.get(vehicleId);
    return this.raw.vehicleEvent.findMany({
      where: { vehicleId, ...SHOWN_VEHICLE_EVENTS },
      orderBy: { occurredAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, name: true } },
        assignment: {
          select: { id: true, rider: { select: { id: true, fullName: true } } },
        },
      },
    });
  }
}
