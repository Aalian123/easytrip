import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationSeverity, NotificationType, Prisma, Role } from '@prisma/client';
import { OIL_STATUS } from '@easytrip/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MaintenanceService } from '../maintenance/maintenance.service';

interface DraftNotification {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  dedupeKey: string;
  entityType?: string;
  entityId?: string;
  dueAt?: Date | null;
  targetRole?: Role;
}

const day = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * FR-20. Alerts are derived from the fleet's own state on a schedule, and each
 * one carries a stable dedupe key so re-running the job never duplicates them.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly maintenance: MaintenanceService,
  ) {}

  list(query: { role: Role; userId: string; unreadOnly?: boolean; take?: number }) {
    // Administrators oversee the whole operation, so they see every alert;
    // everyone else sees what is addressed to their role or to them.
    const audience: Prisma.NotificationWhereInput =
      query.role === 'ADMIN'
        ? {}
        : {
            OR: [
              { targetRole: query.role },
              { targetUserId: query.userId },
              { targetRole: null, targetUserId: null },
            ],
          };

    return this.prisma.notification.findMany({
      where: {
        ...audience,
        ...(query.unreadOnly ? { readAt: null } : {}),
        dismissedAt: null,
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: query.take ?? 50,
    });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(role: Role, userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        ...(role === 'ADMIN'
          ? {}
          : {
              OR: [
                { targetRole: role },
                { targetUserId: userId },
                { targetRole: null, targetUserId: null },
              ],
            }),
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: true };
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scheduledGenerate(): Promise<void> {
    const created = await this.generate();
    this.logger.log(`Alert sweep created ${created} notification(s)`);
  }

  /** Runs the full sweep. Safe to call at any time — duplicates are ignored. */
  async generate(): Promise<number> {
    const settings = await this.settings.get();
    const lead = settings.alertLeadDays;
    const horizon = new Date(Date.now() + lead * 86_400_000);
    const drafts: DraftNotification[] = [];

    for (const vehicle of await this.maintenance.oilDue()) {
      const overdueOil = vehicle.oil.status === OIL_STATUS.OVERDUE;
      drafts.push({
        type: 'OIL_CHANGE_DUE',
        severity: overdueOil ? 'CRITICAL' : 'WARNING',
        title: `${vehicle.registration}: engine oil ${overdueOil ? 'overdue' : 'due soon'}`,
        body: overdueOil
          ? `${Math.abs(vehicle.oil.remainingKm ?? 0).toLocaleString()} km past the change point.`
          : `${(vehicle.oil.remainingKm ?? 0).toLocaleString()} km left before the next change.`,
        // Keyed to the due mileage, so one alert per oil interval.
        dedupeKey: `oil:${vehicle.id}:${vehicle.oil.nextChangeMileage}`,
        entityType: 'Vehicle',
        entityId: vehicle.id,
        targetRole: 'FLEET_MANAGER',
      });
    }

    const overdue = await this.prisma.vehicleAssignment.findMany({
      where: { status: 'ACTIVE', expectedReturnAt: { not: null, lt: new Date() } },
      include: {
        vehicle: { select: { id: true, registration: true } },
        rider: { select: { fullName: true } },
      },
    });
    for (const assignment of overdue) {
      drafts.push({
        type: 'VEHICLE_OVERDUE',
        severity: 'CRITICAL',
        title: `${assignment.vehicle.registration} is overdue`,
        body: `${assignment.rider.fullName} was due to return it on ${day(assignment.expectedReturnAt!)}.`,
        dedupeKey: `overdue:${assignment.id}:${day(assignment.expectedReturnAt!)}`,
        entityType: 'VehicleAssignment',
        entityId: assignment.id,
        dueAt: assignment.expectedReturnAt,
        targetRole: 'FLEET_MANAGER',
      });
    }

    const licences = await this.prisma.rider.findMany({
      where: { status: 'ACTIVE', licenceExpiresAt: { not: null, lte: horizon } },
      select: { id: true, fullName: true, licenceExpiresAt: true },
    });
    for (const rider of licences) {
      const expired = rider.licenceExpiresAt! < new Date();
      drafts.push({
        type: 'LICENCE_EXPIRING',
        severity: expired ? 'CRITICAL' : 'WARNING',
        title: `${rider.fullName}: driving licence ${expired ? 'has expired' : 'expires soon'}`,
        body: `Licence date ${day(rider.licenceExpiresAt!)}.`,
        dedupeKey: `licence:${rider.id}:${day(rider.licenceExpiresAt!)}`,
        entityType: 'Rider',
        entityId: rider.id,
        dueAt: rider.licenceExpiresAt,
        targetRole: 'FLEET_MANAGER',
      });
    }

    const documents = await this.prisma.document.findMany({
      where: { expiresAt: { not: null, lte: horizon } },
      select: { id: true, title: true, docType: true, ownerType: true, ownerId: true, expiresAt: true },
    });
    for (const document of documents) {
      const type: NotificationType =
        document.docType.toUpperCase() === 'INSURANCE'
          ? 'INSURANCE_EXPIRING'
          : document.docType.toUpperCase() === 'REGISTRATION'
            ? 'REGISTRATION_EXPIRING'
            : 'DOCUMENT_EXPIRING';
      drafts.push({
        type,
        severity: document.expiresAt! < new Date() ? 'CRITICAL' : 'WARNING',
        title: `${document.title} expires ${day(document.expiresAt!)}`,
        dedupeKey: `document:${document.id}:${day(document.expiresAt!)}`,
        entityType: document.ownerType === 'VEHICLE' ? 'Vehicle' : 'Rider',
        entityId: document.ownerId,
        dueAt: document.expiresAt,
        targetRole: 'FLEET_MANAGER',
      });
    }

    const cards = await this.prisma.fuelCard.findMany({
      where: { status: { in: ['AVAILABLE', 'ASSIGNED'] }, expiryDate: { not: null, lte: horizon } },
      select: { id: true, cardNumber: true, expiryDate: true },
    });
    for (const card of cards) {
      drafts.push({
        type: 'FUEL_CARD_EXPIRING',
        severity: 'WARNING',
        title: `Fuel card ${card.cardNumber} expires ${day(card.expiryDate!)}`,
        dedupeKey: `card:${card.id}:${day(card.expiryDate!)}`,
        entityType: 'FuelCard',
        entityId: card.id,
        dueAt: card.expiryDate,
        targetRole: 'FLEET_MANAGER',
      });
    }

    const flagged = await this.prisma.fuelTransaction.findMany({
      where: { flagged: true, occurredAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      include: { fuelCard: { select: { cardNumber: true } } },
    });
    for (const transaction of flagged) {
      drafts.push({
        type: 'FUEL_LIMIT_REACHED',
        severity: 'WARNING',
        title: `Fuel card ${transaction.fuelCard.cardNumber} over limit`,
        body: transaction.flagReason ?? undefined,
        dedupeKey: `fuel-limit:${transaction.id}`,
        entityType: 'FuelTransaction',
        entityId: transaction.id,
        targetRole: 'ACCOUNTS',
      });
    }

    const result = await this.prisma.notification.createMany({
      data: drafts.map((draft) => ({
        ...draft,
        body: draft.body ?? null,
        dueAt: draft.dueAt ?? null,
      })) as Prisma.NotificationCreateManyInput[],
      skipDuplicates: true,
    });

    return result.count;
  }
}
