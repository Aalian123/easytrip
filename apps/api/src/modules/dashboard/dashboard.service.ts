import { Injectable } from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { SHOWN_VEHICLE_EVENTS } from '../history/history.service';

/**
 * FR-21. One call fills the whole dashboard: the fleet status bar, the rider
 * and fuel figures, what needs attention today, and the recent activity feed.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async summary() {
    const settings = await this.settings.get();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      statusGroups,
      riderTotal,
      ridersActive,
      ridersHolding,
      cardGroups,
      monthlyFuel,
      overdueCount,
      openAccidents,
      openDamages,
      oilDue,
      recentEvents,
      unpaid,
    ] = await Promise.all([
      this.prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.rider.count(),
      this.prisma.rider.count({ where: { status: 'ACTIVE' } }),
      this.prisma.vehicleAssignment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.fuelCard.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.fuelTransaction.aggregate({
        where: { occurredAt: { gte: monthStart } },
        _sum: { amount: true, litres: true },
      }),
      this.prisma.vehicleAssignment.count({
        where: { status: 'ACTIVE', expectedReturnAt: { not: null, lt: now } },
      }),
      this.prisma.accident.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      this.prisma.damage.count({ where: { repairStatus: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.maintenance.oilDue(),
      this.prisma.vehicleEvent.findMany({
        where: SHOWN_VEHICLE_EVENTS,
        orderBy: { occurredAt: 'desc' },
        take: 12,
        include: {
          vehicle: { select: { id: true, registration: true, status: true } },
          actor: { select: { id: true, name: true } },
        },
      }),
      this.prisma.rentalCharge.aggregate({
        where: { paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(VehicleStatus).map((status) => [status, 0]),
    ) as Record<VehicleStatus, number>;
    for (const row of statusGroups) byStatus[row.status] = row._count._all;
    const fleetTotal = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

    const cardsByStatus: Record<string, number> = {};
    for (const row of cardGroups) cardsByStatus[row.status] = row._count._all;

    const outNow = await this.prisma.vehicleAssignment.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ expectedReturnAt: 'asc' }],
      take: 8,
      include: {
        vehicle: { select: { id: true, registration: true, make: true, model: true } },
        rider: { select: { id: true, fullName: true } },
      },
    });

    return {
      fleet: { total: fleetTotal, byStatus },
      riders: { total: riderTotal, active: ridersActive, holdingVehicles: ridersHolding },
      fuel: {
        totalCards: Object.values(cardsByStatus).reduce((sum, count) => sum + count, 0),
        assigned: cardsByStatus.ASSIGNED ?? 0,
        available: cardsByStatus.AVAILABLE ?? 0,
        monthlySpend: Number(monthlyFuel._sum.amount ?? 0),
        monthlyLitres: Number(monthlyFuel._sum.litres ?? 0),
      },
      operations: {
        maintenanceDue: oilDue.length,
        overdueVehicles: overdueCount,
        openAccidents,
        openDamages,
        outstandingRent:
          Number(unpaid._sum.totalAmount ?? 0) - Number(unpaid._sum.paidAmount ?? 0),
      },
      outNow,
      recentEvents,
      settings: {
        currencySymbol: settings.currencySymbol,
        currencyCode: settings.currencyCode,
        nationalIdLabel: settings.nationalIdLabel,
        organizationName: settings.organizationName,
      },
    };
  }
}
