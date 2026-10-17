import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RiderStatus } from '@prisma/client';
import { CreateRiderInput, Pagination, RIDER_STATUS_LABEL } from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService } from '../../prisma/prisma.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class RidersService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
  ) {}

  async list(query: Pagination & { status?: RiderStatus; q?: string; riderId?: string }) {
    const where: Prisma.RiderWhereInput = {
      ...(query.riderId ? { id: query.riderId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { nationalId: { contains: query.q, mode: 'insensitive' } },
              { contactNumber: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.raw.rider.count({ where }),
      this.raw.rider.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: {
              id: true,
              assignedAt: true,
              expectedReturnAt: true,
              vehicle: { select: { id: true, registration: true, make: true, model: true, status: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      rows: rows.map(({ assignments, ...rider }) => ({
        ...rider,
        currentAssignment: assignments[0] ?? null,
      })),
    };
  }

  async get(id: string) {
    const rider = await this.raw.rider.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            vehicle: { select: { id: true, registration: true, make: true, model: true, status: true } },
          },
        },
        fuelCardAssignments: {
          where: { releasedAt: null },
          take: 1,
          include: { fuelCard: { select: { id: true, cardNumber: true, provider: true, status: true } } },
        },
        _count: { select: { assignments: true, accidents: true, damages: true } },
      },
    });
    if (!rider) throw new NotFoundException('That rider no longer exists.');

    const { assignments, fuelCardAssignments, ...rest } = rider;
    return {
      ...rest,
      currentAssignment: assignments[0] ?? null,
      currentFuelCard: fuelCardAssignments[0]?.fuelCard ?? null,
    };
  }

  async create(input: CreateRiderInput) {
    return this.prisma.$transaction(async (tx) => {
      const rider = await tx.rider.create({ data: input });
      await this.history.recordRiderEvent(tx, {
        riderId: rider.id,
        type: 'RIDER_ADDED',
        summary: `${rider.fullName} added to the rider list`,
      });
      return rider;
    });
  }

  async update(id: string, input: Partial<CreateRiderInput>) {
    await this.get(id);
    return this.prisma.rider.update({ where: { id }, data: input });
  }

  async changeStatus(id: string, status: RiderStatus, reason?: string | null) {
    const rider = await this.get(id);
    if (rider.status === status) return rider;

    await this.prisma.$transaction(async (tx) => {
      await tx.rider.update({ where: { id }, data: { status } });
      await this.history.recordRiderEvent(tx, {
        riderId: id,
        type: 'STATUS_CHANGED',
        summary: reason
          ? `${RIDER_STATUS_LABEL[rider.status]} to ${RIDER_STATUS_LABEL[status]}: ${reason}`
          : `${RIDER_STATUS_LABEL[rider.status]} to ${RIDER_STATUS_LABEL[status]}`,
        payload: { from: rider.status, to: status, reason: reason ?? null },
      });
    });

    return this.get(id);
  }

  /** Everything this rider has done, newest first (FR-03). */
  async history_(riderId: string, take = 200) {
    await this.get(riderId);
    const [events, assignments] = await Promise.all([
      this.raw.riderEvent.findMany({
        where: { riderId },
        orderBy: { occurredAt: 'desc' },
        take,
        include: { actor: { select: { id: true, name: true } } },
      }),
      this.raw.vehicleAssignment.findMany({
        where: { riderId },
        orderBy: { assignedAt: 'desc' },
        take: 50,
        include: {
          vehicle: { select: { id: true, registration: true, make: true, model: true } },
          rentalCharge: { select: { totalAmount: true, paymentStatus: true } },
        },
      }),
    ]);
    return { events, assignments };
  }
}
