import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateMaintenanceInput,
  OIL_STATUS,
  calculateOilStatus,
  detectLinkProvider,
} from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService, TxClient } from '../../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { SettingsService } from '../settings/settings.service';
import { currentContext } from '../../context/request-context';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
    private readonly settings: SettingsService,
  ) {}

  async list(query: { page: number; pageSize: number; vehicleId?: string; type?: string }) {
    const where: Prisma.MaintenanceRecordWhereInput = {
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.type ? { type: query.type as never } : {}),
    };
    const [total, rows] = await Promise.all([
      this.raw.maintenanceRecord.count({ where }),
      this.raw.maintenanceRecord.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { vehicle: { select: { id: true, registration: true, make: true, model: true } } },
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, rows };
  }

  /**
   * FR-13 / FR-14. The one way a service is recorded. Records only ever
   * accumulate — the database rejects edits (BR-08). Engine oil is a service
   * like any other, and also moves the vehicle's oil counter.
   */
  async record(input: CreateMaintenanceInput) {
    const settings = await this.settings.get();

    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');

      const isOil = input.type === 'ENGINE_OIL';
      const intervalKm = isOil
        ? input.intervalKm ?? vehicle.oilChangeIntervalKm ?? settings.defaultOilIntervalKm
        : null;

      const record = await this.writeRecord(tx, {
        ...input,
        partsReplaced: input.partsReplaced ?? (isOil ? 'Engine oil' : null),
        nextServiceMileage: input.nextServiceMileage ?? (intervalKm ? input.mileage + intervalKm : null),
      });

      // An older change filled in late is kept on file but does not wind the
      // oil counter back.
      const newerOilChange =
        isOil && (vehicle.lastOilChangeMileage == null || input.mileage >= vehicle.lastOilChangeMileage);

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          currentMileage: Math.max(input.mileage, vehicle.currentMileage),
          ...(newerOilChange
            ? {
                lastOilChangeDate: input.performedAt,
                lastOilChangeMileage: input.mileage,
                oilChangeIntervalKm: intervalKm,
              }
            : {}),
        },
      });

      await this.history.recordVehicleEvent(tx, {
        vehicleId: input.vehicleId,
        type: isOil ? 'OIL_CHANGED' : 'MAINTENANCE_PERFORMED',
        occurredAt: input.performedAt,
        summary: isOil
          ? `Engine oil changed at ${input.mileage.toLocaleString()} km, next due at ${(input.mileage + intervalKm!).toLocaleString()} km`
          : `${this.label(input.type)} at ${input.mileage.toLocaleString()} km`,
        payload: {
          maintenanceId: record.id,
          cost: input.cost ?? null,
          provider: input.serviceProvider ?? null,
          ...(isOil ? { intervalKm } : {}),
        },
      });

      return record;
    });
  }

  /** Vehicles whose oil is due or overdue, worst first (FR-14, FR-20). */
  async oilDue() {
    const settings = await this.settings.get();
    const vehicles = await this.raw.vehicle.findMany({
      where: { status: { notIn: ['INACTIVE', 'OUT_OF_SERVICE'] } },
      select: {
        id: true,
        registration: true,
        make: true,
        model: true,
        status: true,
        currentMileage: true,
        lastOilChangeDate: true,
        lastOilChangeMileage: true,
        oilChangeIntervalKm: true,
      },
    });

    return vehicles
      .map((vehicle) => ({
        ...vehicle,
        oil: calculateOilStatus({
          currentMileage: vehicle.currentMileage,
          lastOilChangeMileage: vehicle.lastOilChangeMileage,
          oilChangeIntervalKm: vehicle.oilChangeIntervalKm,
          warnWithinKm: settings.oilWarnWithinKm,
        }),
      }))
      .filter((row) => row.oil.status === OIL_STATUS.DUE_SOON || row.oil.status === OIL_STATUS.OVERDUE)
      .sort((a, b) => (a.oil.remainingKm ?? 0) - (b.oil.remainingKm ?? 0));
  }

  /**
   * Services booked ahead, by date or by mileage. Only the latest record of each
   * kind per vehicle counts, since a newer service replaces the booking, and
   * engine oil is left out: its own list works from the vehicle's oil counter.
   */
  async upcoming(withinDays: number) {
    const settings = await this.settings.get();
    const until = new Date(Date.now() + withinDays * 86_400_000);
    const records = await this.raw.maintenanceRecord.findMany({
      where: {
        type: { not: 'ENGINE_OIL' },
        OR: [{ nextServiceDate: { not: null } }, { nextServiceMileage: { not: null } }],
      },
      orderBy: [{ performedAt: 'desc' }],
      include: { vehicle: { select: { id: true, registration: true, currentMileage: true } } },
      take: 500,
    });

    const seen = new Set<string>();
    return records
      .filter((record) => {
        const key = `${record.vehicleId}:${record.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter(
        (record) =>
          (record.nextServiceDate && record.nextServiceDate <= until) ||
          (record.nextServiceMileage != null &&
            record.vehicle.currentMileage >= record.nextServiceMileage - settings.oilWarnWithinKm),
      )
      .sort((a, b) => (a.nextServiceDate?.getTime() ?? Infinity) - (b.nextServiceDate?.getTime() ?? Infinity));
  }

  private async writeRecord(tx: TxClient, input: CreateMaintenanceInput) {
    const record = await tx.maintenanceRecord.create({
      data: {
        vehicleId: input.vehicleId,
        type: input.type,
        performedAt: input.performedAt,
        mileage: input.mileage,
        serviceProvider: input.serviceProvider ?? null,
        partsReplaced: input.partsReplaced ?? null,
        description: input.description ?? null,
        cost: input.cost != null ? new Prisma.Decimal(input.cost) : null,
        invoiceUrl: input.invoiceUrl ?? null,
        nextServiceDate: input.nextServiceDate ?? null,
        nextServiceMileage: input.nextServiceMileage ?? null,
      },
    });

    for (const url of input.mediaUrls ?? []) {
      await tx.mediaLink.create({
        data: {
          url,
          provider: detectLinkProvider(url),
          category: 'MAINTENANCE',
          vehicleId: input.vehicleId,
          maintenanceId: record.id,
          uploadedById: currentContext().userId ?? null,
        },
      });
    }

    return record;
  }

  private label(type: string): string {
    return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
  }
}
