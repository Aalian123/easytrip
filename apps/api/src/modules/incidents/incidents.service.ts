import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccidentStatus, Prisma } from '@prisma/client';
import {
  CreateAccidentInput,
  CreateDamageInput,
  UpdateAccidentInput,
  detectLinkProvider,
} from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService, TxClient } from '../../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { VehicleStatusService } from '../vehicles/vehicle-status.service';
import { currentContext } from '../../context/request-context';
import { decimalOrNull } from '../../common/decimal';

const CLOSED_STATUSES: AccidentStatus[] = ['RESOLVED', 'CLOSED'];

@Injectable()
export class IncidentsService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
    private readonly vehicleStatus: VehicleStatusService,
  ) {}

  // ------------------------------------------------------------- accidents

  listAccidents(query: { page: number; pageSize: number; status?: AccidentStatus; vehicleId?: string; riderId?: string }) {
    const where: Prisma.AccidentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.riderId ? { riderId: query.riderId } : {}),
    };
    return Promise.all([
      this.raw.accident.count({ where }),
      this.raw.accident.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          vehicle: { select: { id: true, registration: true, make: true, model: true } },
          rider: { select: { id: true, fullName: true } },
          _count: { select: { damages: true, mediaLinks: true } },
        },
      }),
    ]).then(([total, rows]) => ({ total, page: query.page, pageSize: query.pageSize, rows }));
  }

  async getAccident(id: string) {
    const accident = await this.raw.accident.findUnique({
      where: { id },
      include: {
        vehicle: true,
        rider: true,
        assignment: { select: { id: true, assignedAt: true, returnedAt: true } },
        damages: { include: { mediaLinks: true } },
        mediaLinks: { include: { uploadedBy: { select: { id: true, name: true } } } },
      },
    });
    if (!accident) throw new NotFoundException('That accident report no longer exists.');
    return accident;
  }

  /** FR-08. Riders can file these themselves from the roadside. */
  async reportAccident(input: CreateAccidentInput) {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');

      // Tie the report to whichever assignment was live when it happened, so
      // responsibility can be traced back to a rider later.
      const assignmentId =
        input.assignmentId ??
        (
          await tx.vehicleAssignment.findFirst({
            where: {
              vehicleId: input.vehicleId,
              assignedAt: { lte: input.occurredAt },
              OR: [{ returnedAt: null }, { returnedAt: { gte: input.occurredAt } }],
            },
            orderBy: { assignedAt: 'desc' },
            select: { id: true, riderId: true },
          })
        )?.id ??
        null;

      const riderId =
        input.riderId ??
        (assignmentId
          ? (await tx.vehicleAssignment.findUnique({ where: { id: assignmentId }, select: { riderId: true } }))
              ?.riderId ?? null
          : null);

      const accident = await tx.accident.create({
        data: {
          reference: await this.nextReference(tx),
          vehicleId: input.vehicleId,
          riderId,
          assignmentId,
          occurredAt: input.occurredAt,
          location: input.location,
          description: input.description,
          riderStatement: input.riderStatement ?? null,
          thirdParty: (input.thirdParty ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          policeReport: input.policeReport ?? null,
          insuranceInfo: input.insuranceInfo ?? null,
          estimatedRepairCost:
            input.estimatedRepairCost != null ? new Prisma.Decimal(input.estimatedRepairCost) : null,
        },
      });

      for (const url of input.mediaUrls) {
        await tx.mediaLink.create({
          data: {
            url,
            provider: detectLinkProvider(url),
            category: 'ACCIDENT',
            vehicleId: input.vehicleId,
            riderId,
            assignmentId,
            accidentId: accident.id,
            uploadedById: currentContext().userId ?? null,
          },
        });
      }

      await this.history.recordVehicleEvent(tx, {
        vehicleId: input.vehicleId,
        assignmentId,
        type: 'ACCIDENT_REPORTED',
        occurredAt: input.occurredAt,
        summary: `Accident ${accident.reference} at ${input.location}`,
        payload: { accidentId: accident.id, photos: input.mediaUrls.length },
      });

      // A vehicle standing in the yard is taken off the road straight away. One
      // that is out with a rider changes status when it is returned.
      const out = await tx.vehicleAssignment.findFirst({
        where: { vehicleId: input.vehicleId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!out && this.vehicleStatus.canTransition(vehicle.status, 'ACCIDENT')) {
        await this.vehicleStatus.transition(tx, input.vehicleId, 'ACCIDENT', accident.reference);
      }

      if (riderId) {
        await this.history.recordRiderEvent(tx, {
          riderId,
          type: 'ACCIDENT_REPORTED',
          occurredAt: input.occurredAt,
          summary: `Accident ${accident.reference} in ${vehicle.registration}`,
          payload: { accidentId: accident.id },
        });
      }

      return accident;
    });
  }

  /**
   * FR-08 / BR-07. Responsibility is a separate decision from the report, and
   * changing it leaves its own trace on the vehicle timeline.
   */
  async updateAccident(id: string, input: UpdateAccidentInput) {
    const existing = await this.getAccident(id);

    return this.prisma.$transaction(async (tx) => {
      const accident = await tx.accident.update({
        where: { id },
        data: {
          ...input,
          estimatedRepairCost:
            input.estimatedRepairCost != null ? new Prisma.Decimal(input.estimatedRepairCost) : undefined,
          actualRepairCost:
            input.actualRepairCost != null ? new Prisma.Decimal(input.actualRepairCost) : undefined,
          resolvedAt:
            input.status && CLOSED_STATUSES.includes(input.status) && !existing.resolvedAt
              ? new Date()
              : undefined,
        },
      });

      const changes: string[] = [];
      if (input.responsibility && input.responsibility !== existing.responsibility) {
        changes.push(
          `responsibility set to ${input.responsibility.toLowerCase().replace(/_/g, ' ')}`,
        );
      }
      if (input.status && input.status !== existing.status) {
        changes.push(`status ${input.status.toLowerCase().replace(/_/g, ' ')}`);
      }
      if (input.actualRepairCost != null && Number(existing.actualRepairCost ?? 0) !== input.actualRepairCost) {
        changes.push(`repair cost ${input.actualRepairCost}`);
      }

      if (changes.length) {
        await this.history.recordVehicleEvent(tx, {
          vehicleId: accident.vehicleId,
          assignmentId: accident.assignmentId,
          type: 'ACCIDENT_UPDATED',
          summary: `Accident ${accident.reference}: ${changes.join(', ')}`,
          payload: {
            accidentId: accident.id,
            from: { status: existing.status, responsibility: existing.responsibility },
            to: { status: accident.status, responsibility: accident.responsibility },
          },
        });
      }

      return accident;
    });
  }

  // --------------------------------------------------------------- damages

  listDamages(query: { page: number; pageSize: number; vehicleId?: string; riderId?: string; repairStatus?: string }) {
    const where: Prisma.DamageWhereInput = {
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.riderId ? { riderId: query.riderId } : {}),
      ...(query.repairStatus ? { repairStatus: query.repairStatus as never } : {}),
    };
    return Promise.all([
      this.raw.damage.count({ where }),
      this.raw.damage.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          vehicle: { select: { id: true, registration: true } },
          rider: { select: { id: true, fullName: true } },
          assignment: { select: { id: true, assignedAt: true } },
          mediaLinks: true,
        },
      }),
    ]).then(([total, rows]) => ({ total, page: query.page, pageSize: query.pageSize, rows }));
  }

  /** FR-09. Damage found outside a return still attaches to the assignment that was live. */
  async recordDamage(input: CreateDamageInput) {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');

      const live = input.assignmentId
        ? await tx.vehicleAssignment.findUnique({
            where: { id: input.assignmentId },
            select: { id: true, riderId: true },
          })
        : await tx.vehicleAssignment.findFirst({
            where: {
              vehicleId: input.vehicleId,
              assignedAt: { lte: input.detectedAt },
              OR: [{ returnedAt: null }, { returnedAt: { gte: input.detectedAt } }],
            },
            orderBy: { assignedAt: 'desc' },
            select: { id: true, riderId: true },
          });
      const linked = live?.id ?? null;
      // Same as an accident: the rider who had the vehicle, unless named.
      const riderId = input.riderId ?? live?.riderId ?? null;

      const damage = await tx.damage.create({
        data: {
          vehicleId: input.vehicleId,
          riderId,
          assignmentId: linked,
          accidentId: input.accidentId ?? null,
          detectedAt: input.detectedAt,
          category: input.category,
          severity: input.severity,
          description: input.description,
          estimatedCost: input.estimatedCost != null ? new Prisma.Decimal(input.estimatedCost) : null,
          responsibleParty: input.responsibleParty,
          chargedToRider: input.chargedToRider,
        },
      });

      for (const url of input.mediaUrls) {
        await tx.mediaLink.create({
          data: {
            url,
            provider: detectLinkProvider(url),
            category: 'DAMAGE',
            vehicleId: input.vehicleId,
            assignmentId: linked,
            damageId: damage.id,
            uploadedById: currentContext().userId ?? null,
          },
        });
      }

      await this.history.recordVehicleEvent(tx, {
        vehicleId: input.vehicleId,
        assignmentId: linked,
        type: 'DAMAGE_RECORDED',
        occurredAt: input.detectedAt,
        summary: `${input.severity.toLowerCase()} ${input.category.toLowerCase().replace(/_/g, ' ')} recorded`,
        payload: { damageId: damage.id, responsibleParty: input.responsibleParty },
      });

      if (riderId) {
        await this.history.recordRiderEvent(tx, {
          riderId,
          type: 'DAMAGE_RECORDED',
          occurredAt: input.detectedAt,
          summary: `Damage recorded on ${vehicle.registration}`,
          payload: { damageId: damage.id },
        });
      }

      return damage;
    });
  }

  async updateDamage(id: string, input: Record<string, unknown>) {
    const existing = await this.raw.damage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('That damage record no longer exists.');
    if (existing.repairStatus === 'WRITTEN_OFF' && input.repairStatus) {
      throw new ConflictException('A written-off vehicle damage record cannot be reopened.');
    }
    return this.prisma.damage.update({
      where: { id },
      data: {
        ...input,
        estimatedCost: decimalOrNull(input.estimatedCost as number | null | undefined),
        actualCost: decimalOrNull(input.actualCost as number | null | undefined),
      } as Prisma.DamageUpdateInput,
    });
  }

  /** Human-readable accident references: ACC-2026-0007. */
  private async nextReference(tx: TxClient): Promise<string> {
    const year = new Date().getFullYear();
    const count = await tx.accident.count({
      where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
    });
    return `ACC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
