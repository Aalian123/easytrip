import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VehicleStatus } from '@prisma/client';
import {
  CHECKLIST_ITEMS,
  Checklist,
  ConditionGrade,
  CreateAssignmentInput,
  CreateInspectionInput,
  FUEL_CARD_UNASSIGNABLE,
  RIDER_BLOCKED_STATUSES,
  ReturnVehicleInput,
  VEHICLE_STATUS_LABEL,
  calculateRentalCharge,
  detectLinkProvider,
} from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService, TxClient } from '../../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { VehicleStatusService } from '../vehicles/vehicle-status.service';
import { SettingsService } from '../settings/settings.service';
import { currentContext } from '../../context/request-context';

const ASSIGNABLE_FROM: VehicleStatus[] = ['AVAILABLE', 'RESERVED'];

const FUEL_LABELS = ['empty', '1/8', '1/4', '3/8', 'half', '5/8', '3/4', '7/8', 'full'];

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
    private readonly vehicleStatus: VehicleStatusService,
    private readonly settings: SettingsService,
  ) {}

  async list(query: {
    page: number;
    pageSize: number;
    status?: 'ACTIVE' | 'RETURNED' | 'CANCELLED';
    vehicleId?: string;
    riderId?: string;
    overdue?: boolean;
  }) {
    const where: Prisma.VehicleAssignmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.riderId ? { riderId: query.riderId } : {}),
      ...(query.overdue
        ? { status: 'ACTIVE', expectedReturnAt: { not: null, lt: new Date() } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.raw.vehicleAssignment.count({ where }),
      this.raw.vehicleAssignment.findMany({
        where,
        orderBy: { assignedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          vehicle: { select: { id: true, registration: true, make: true, model: true, status: true } },
          rider: { select: { id: true, fullName: true, contactNumber: true } },
          fuelCard: { select: { id: true, cardNumber: true } },
          rentalCharge: { select: { totalAmount: true, paymentStatus: true } },
        },
      }),
    ]);

    return { total, page: query.page, pageSize: query.pageSize, rows };
  }

  async get(id: string) {
    const assignment = await this.raw.vehicleAssignment.findUnique({
      where: { id },
      include: {
        vehicle: true,
        rider: true,
        fuelCard: { select: { id: true, cardNumber: true, provider: true } },
        inspections: { include: { mediaLinks: true }, orderBy: { inspectedAt: 'asc' } },
        damages: { include: { mediaLinks: true } },
        accidents: true,
        rentalCharge: true,
        mediaLinks: true,
      },
    });
    if (!assignment) throw new NotFoundException('That assignment no longer exists.');
    return assignment;
  }

  /** FR-04. Everything that makes a handover legal is checked here. */
  async assign(input: CreateAssignmentInput) {
    const settings = await this.settings.get();

    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');

      // BR-01
      if (!ASSIGNABLE_FROM.includes(vehicle.status)) {
        throw new ConflictException(
          `${vehicle.registration} is not available right now. It is ${VEHICLE_STATUS_LABEL[vehicle.status].toLowerCase()}.`,
        );
      }
      const alreadyOut = await tx.vehicleAssignment.findFirst({
        where: { vehicleId: vehicle.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (alreadyOut) {
        throw new ConflictException(`${vehicle.registration} is already out with a rider. Record its return first.`);
      }

      const rider = await tx.rider.findUnique({ where: { id: input.riderId } });
      if (!rider) throw new NotFoundException('That rider no longer exists.');
      if (RIDER_BLOCKED_STATUSES.includes(rider.status as never)) {
        throw new ConflictException(
          `${rider.fullName} is ${rider.status.toLowerCase()} and cannot be given a vehicle.`,
        );
      }

      // BR-03 — one vehicle per rider unless an administrator has allowed more.
      if (!settings.allowMultipleActiveAssignments) {
        const held = await tx.vehicleAssignment.findFirst({
          where: { riderId: input.riderId, status: 'ACTIVE' },
          include: { vehicle: { select: { registration: true } } },
        });
        if (held) {
          throw new ConflictException(
            `${rider.fullName} already has ${held.vehicle.registration}. Return it first, or allow multiple vehicles in settings.`,
          );
        }
      }

      if (input.startMileage < vehicle.currentMileage) {
        throw new BadRequestException(
          `Starting mileage cannot be below the recorded ${vehicle.currentMileage.toLocaleString()} km.`,
        );
      }

      if (input.fuelCardId) await this.assertCardAssignable(tx, input.fuelCardId);

      // The rate in force on the day of handover. A backdated assignment made
      // before any rate was entered falls back to the earliest one on file
      // rather than billing at zero.
      const rate =
        (await tx.rentalRate.findFirst({
          where: { vehicleId: input.vehicleId, effectiveFrom: { lte: input.assignedAt } },
          orderBy: { effectiveFrom: 'desc' },
        })) ??
        (await tx.rentalRate.findFirst({
          where: { vehicleId: input.vehicleId },
          orderBy: { effectiveFrom: 'asc' },
        }));

      const assignment = await tx.vehicleAssignment.create({
        data: {
          vehicleId: input.vehicleId,
          riderId: input.riderId,
          assignedAt: input.assignedAt,
          expectedReturnAt: input.expectedReturnAt ?? null,
          startMileage: input.startMileage,
          startFuelLevel: input.startFuelLevel ?? null,
          fuelCardId: input.fuelCardId ?? null,
          notes: input.notes ?? null,
          // The rate is frozen here so a later rate change cannot rewrite
          // what this rental costs.
          rateSnapshot: rate
            ? {
                dailyRate: Number(rate.dailyRate),
                weeklyRate: rate.weeklyRate ? Number(rate.weeklyRate) : null,
                monthlyRate: rate.monthlyRate ? Number(rate.monthlyRate) : null,
                securityDeposit: rate.securityDeposit ? Number(rate.securityDeposit) : null,
                lateReturnFeePerDay: rate.lateReturnFeePerDay ? Number(rate.lateReturnFeePerDay) : null,
                rateId: rate.id,
              }
            : Prisma.JsonNull,
        },
      });

      if (input.startMileage > vehicle.currentMileage) {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { currentMileage: input.startMileage },
        });
      }

      if (input.fuelCardId) {
        await this.holdFuelCard(tx, input.fuelCardId, input.riderId, input.vehicleId, assignment.id, input.assignedAt);
      }

      await this.vehicleStatus.transition(tx, input.vehicleId, 'ASSIGNED', null, assignment.id);

      await this.history.recordVehicleEvent(tx, {
        vehicleId: input.vehicleId,
        type: 'ASSIGNED',
        occurredAt: input.assignedAt,
        assignmentId: assignment.id,
        summary: `Assigned to ${rider.fullName}`,
        payload: {
          riderId: rider.id,
          startMileage: input.startMileage,
          startFuelLevel: input.startFuelLevel ?? null,
          expectedReturnAt: input.expectedReturnAt ?? null,
        },
      });

      await this.history.recordRiderEvent(tx, {
        riderId: rider.id,
        type: 'VEHICLE_ASSIGNED',
        occurredAt: input.assignedAt,
        summary: `Took ${vehicle.registration} (${vehicle.make} ${vehicle.model})`,
        payload: { vehicleId: vehicle.id, assignmentId: assignment.id },
      });

      return assignment;
    });
  }

  /** FR-05. Submitted inspections are frozen by a database trigger. */
  async addInspection(assignmentId: string, input: CreateInspectionInput) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.vehicleAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw new NotFoundException('That assignment no longer exists.');
      if (input.type === 'HANDOVER' && assignment.status !== 'ACTIVE') {
        throw new ConflictException('This assignment has already been closed.');
      }
      return this.writeInspection(tx, assignment.id, assignment.vehicleId, input);
    });
  }

  /** FR-06. The return is where damage, charges and the vehicle's next state are settled. */
  async returnVehicle(assignmentId: string, input: ReturnVehicleInput) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.vehicleAssignment.findUnique({
        where: { id: assignmentId },
        include: { vehicle: true, rider: true },
      });
      if (!assignment) throw new NotFoundException('That assignment no longer exists.');
      if (assignment.status !== 'ACTIVE') {
        throw new ConflictException('This vehicle has already been returned.');
      }
      if (input.endMileage < assignment.startMileage) {
        throw new BadRequestException(
          `Final mileage cannot be below the ${assignment.startMileage.toLocaleString()} km recorded at handover.`,
        );
      }

      if (input.inspection) {
        await this.writeInspection(tx, assignment.id, assignment.vehicleId, {
          ...input.inspection,
          type: 'RETURN',
          mileage: input.inspection.mileage ?? input.endMileage,
        });
      }

      for (const damage of input.newDamages) {
        const created = await tx.damage.create({
          data: {
            vehicleId: assignment.vehicleId,
            riderId: assignment.riderId,
            assignmentId: assignment.id,
            detectedAt: input.returnedAt,
            category: damage.category,
            severity: damage.severity,
            description: damage.description,
            estimatedCost: damage.estimatedCost != null ? new Prisma.Decimal(damage.estimatedCost) : null,
            responsibleParty: damage.responsibleParty,
            chargedToRider: damage.chargedToRider,
          },
        });

        for (const url of damage.mediaUrls) {
          await tx.mediaLink.create({
            data: {
              url,
              provider: detectLinkProvider(url),
              category: 'DAMAGE',
              vehicleId: assignment.vehicleId,
              assignmentId: assignment.id,
              damageId: created.id,
              uploadedById: currentContext().userId ?? null,
            },
          });
        }

        await this.history.recordVehicleEvent(tx, {
          vehicleId: assignment.vehicleId,
          type: 'DAMAGE_RECORDED',
          occurredAt: input.returnedAt,
          assignmentId: assignment.id,
          summary: `${damage.severity.toLowerCase()} ${damage.category.toLowerCase().replace(/_/g, ' ')} found at return`,
          payload: { damageId: created.id, responsibleParty: damage.responsibleParty },
        });
        await this.history.recordRiderEvent(tx, {
          riderId: assignment.riderId,
          type: 'DAMAGE_RECORDED',
          occurredAt: input.returnedAt,
          summary: `Damage recorded on ${assignment.vehicle.registration}`,
          payload: { damageId: created.id },
        });
      }

      const charge = this.priceAssignment(assignment, input);

      await tx.rentalCharge.create({
        data: {
          assignmentId: assignment.id,
          vehicleId: assignment.vehicleId,
          billedDays: charge.billedDays,
          lateDays: charge.lateDays,
          lines: charge.lines as unknown as Prisma.InputJsonValue,
          baseAmount: new Prisma.Decimal(charge.baseAmount),
          lateFee: new Prisma.Decimal(charge.lateFee),
          fuelCharge: new Prisma.Decimal(input.fuelCharge),
          damageCharge: new Prisma.Decimal(input.damageCharge),
          trafficFines: new Prisma.Decimal(input.trafficFines),
          otherCharges: new Prisma.Decimal(input.otherCharges),
          discount: new Prisma.Decimal(input.discount),
          totalAmount: new Prisma.Decimal(charge.total),
        },
      });

      await tx.vehicleAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'RETURNED',
          returnedAt: input.returnedAt,
          endMileage: input.endMileage,
          endFuelLevel: input.endFuelLevel ?? null,
          returnNotes: input.returnNotes ?? null,
        },
      });

      await tx.vehicle.update({
        where: { id: assignment.vehicleId },
        data: { currentMileage: Math.max(input.endMileage, assignment.vehicle.currentMileage) },
      });

      // Every card this rider holds for this vehicle comes back with it, whether
      // it went out at handover or was issued from the card page later.
      if (input.releaseFuelCard) {
        const cards = await tx.fuelCardAssignment.findMany({
          where: { riderId: assignment.riderId, vehicleId: assignment.vehicleId, releasedAt: null },
          select: { fuelCardId: true },
        });
        for (const { fuelCardId } of cards) {
          await this.releaseFuelCard(tx, fuelCardId, assignment.vehicleId, assignment.riderId, input.returnedAt);
        }
      }

      await this.vehicleStatus.transition(
        tx,
        assignment.vehicleId,
        input.vehicleStatusAfter,
        input.newDamages.length ? 'damage found at return' : 'returned',
        assignment.id,
      );

      const distance = input.endMileage - assignment.startMileage;
      await this.history.recordVehicleEvent(tx, {
        vehicleId: assignment.vehicleId,
        type: 'RETURNED',
        occurredAt: input.returnedAt,
        assignmentId: assignment.id,
        summary: `Returned by ${assignment.rider.fullName} after ${distance.toLocaleString()} km`,
        payload: {
          endMileage: input.endMileage,
          endFuelLevel: input.endFuelLevel ?? null,
          newDamages: input.newDamages.length,
          total: charge.total,
        },
      });

      await this.history.recordVehicleEvent(tx, {
        vehicleId: assignment.vehicleId,
        type: 'RENTAL_CHARGED',
        occurredAt: input.returnedAt,
        assignmentId: assignment.id,
        summary: `Rental charged for ${charge.billedDays} day${charge.billedDays === 1 ? '' : 's'}`,
        payload: { total: charge.total, lateDays: charge.lateDays },
      });

      await this.history.recordRiderEvent(tx, {
        riderId: assignment.riderId,
        type: 'VEHICLE_RETURNED',
        occurredAt: input.returnedAt,
        summary: `Returned ${assignment.vehicle.registration}`,
        payload: { assignmentId: assignment.id, total: charge.total },
      });

      return { assignmentId: assignment.id, charge };
    });
  }

  /**
   * FR-06: what changed between handover and return, item by item. The two
   * inspections are read as recorded — nothing here rewrites either of them.
   */
  async comparison(assignmentId: string) {
    const assignment = await this.get(assignmentId);
    const handover = assignment.inspections.find((i) => i.type === 'HANDOVER') ?? null;
    const returned = assignment.inspections.find((i) => i.type === 'RETURN') ?? null;

    const handoverList = (handover?.checklist ?? {}) as Checklist;
    const returnList = (returned?.checklist ?? {}) as Checklist;

    const items = CHECKLIST_ITEMS.map((item) => {
      const before = handoverList[item.key]?.grade ?? ConditionGrade.NA;
      const after = returnList[item.key]?.grade ?? ConditionGrade.NA;
      const order: Record<string, number> = { NA: -1, OK: 0, MINOR: 1, DAMAGE: 2 };
      return {
        key: item.key,
        label: item.label,
        before,
        after,
        beforeNote: handoverList[item.key]?.note ?? null,
        afterNote: returnList[item.key]?.note ?? null,
        worsened: order[after] > order[before],
      };
    });

    return {
      assignment: {
        id: assignment.id,
        vehicle: assignment.vehicle,
        rider: assignment.rider,
        assignedAt: assignment.assignedAt,
        returnedAt: assignment.returnedAt,
      },
      handover,
      return: returned,
      items,
      worsenedCount: items.filter((i) => i.worsened).length,
      mileage: {
        start: assignment.startMileage,
        end: assignment.endMileage,
        distance: assignment.endMileage != null ? assignment.endMileage - assignment.startMileage : null,
      },
      fuel: {
        start: assignment.startFuelLevel,
        end: assignment.endFuelLevel,
        startLabel: assignment.startFuelLevel != null ? FUEL_LABELS[assignment.startFuelLevel] : null,
        endLabel: assignment.endFuelLevel != null ? FUEL_LABELS[assignment.endFuelLevel] : null,
      },
      damages: assignment.damages,
    };
  }

  // ---------------------------------------------------------------- helpers

  private priceAssignment(
    assignment: { assignedAt: Date; expectedReturnAt: Date | null; rateSnapshot: Prisma.JsonValue },
    input: ReturnVehicleInput,
  ) {
    const snapshot = (assignment.rateSnapshot ?? {}) as {
      dailyRate?: number;
      weeklyRate?: number | null;
      monthlyRate?: number | null;
      lateReturnFeePerDay?: number | null;
    };

    return calculateRentalCharge({
      startAt: assignment.assignedAt,
      endAt: input.returnedAt,
      expectedReturnAt: assignment.expectedReturnAt,
      rates: {
        dailyRate: snapshot.dailyRate ?? 0,
        weeklyRate: snapshot.weeklyRate ?? null,
        monthlyRate: snapshot.monthlyRate ?? null,
        lateReturnFeePerDay: snapshot.lateReturnFeePerDay ?? null,
      },
      extras: {
        fuelCharge: input.fuelCharge,
        damageCharge: input.damageCharge,
        trafficFines: input.trafficFines,
        otherCharges: input.otherCharges,
        discount: input.discount,
      },
    });
  }

  private async writeInspection(
    tx: TxClient,
    assignmentId: string,
    vehicleId: string,
    input: CreateInspectionInput,
  ) {
    const inspection = await tx.inspection.create({
      data: {
        type: input.type,
        assignmentId,
        vehicleId,
        mileage: input.mileage,
        fuelLevel: input.fuelLevel ?? null,
        checklist: input.checklist as unknown as Prisma.InputJsonValue,
        existingDamageNotes: input.existingDamageNotes ?? null,
        accessoriesNotes: input.accessoriesNotes ?? null,
        documentsProvided: input.documentsProvided,
        notes: input.notes ?? null,
        inspectedById: currentContext().userId ?? null,
        // Submitted immediately: an inspection is evidence, not a draft.
        submittedAt: new Date(),
      },
    });

    for (const url of input.mediaUrls) {
      await tx.mediaLink.create({
        data: {
          url,
          provider: detectLinkProvider(url),
          category: input.type === 'HANDOVER' ? 'HANDOVER' : 'RETURN',
          vehicleId,
          assignmentId,
          inspectionId: inspection.id,
          uploadedById: currentContext().userId ?? null,
        },
      });
    }

    const flagged = Object.values(input.checklist).filter((entry) =>
      [ConditionGrade.MINOR, ConditionGrade.DAMAGE].includes(entry.grade as never),
    ).length;

    await this.history.recordVehicleEvent(tx, {
      vehicleId,
      assignmentId,
      type: input.type === 'HANDOVER' ? 'HANDOVER_INSPECTED' : 'RETURN_INSPECTED',
      summary:
        input.type === 'HANDOVER'
          ? `Handover inspection at ${input.mileage.toLocaleString()} km`
          : `Return inspection at ${input.mileage.toLocaleString()} km`,
      payload: { inspectionId: inspection.id, flaggedItems: flagged, photos: input.mediaUrls.length },
    });

    return inspection;
  }

  private async assertCardAssignable(tx: TxClient, fuelCardId: string): Promise<void> {
    const card = await tx.fuelCard.findUnique({ where: { id: fuelCardId } });
    if (!card) throw new NotFoundException('That fuel card no longer exists.');

    // BR-12
    if (FUEL_CARD_UNASSIGNABLE.includes(card.status as never)) {
      throw new ConflictException(`Fuel card ${card.cardNumber} is ${card.status.toLowerCase()} and cannot be issued.`);
    }
    if (card.expiryDate && card.expiryDate < new Date()) {
      throw new ConflictException(`Fuel card ${card.cardNumber} expired on ${card.expiryDate.toISOString().slice(0, 10)}.`);
    }

    const held = await tx.fuelCardAssignment.findFirst({
      where: { fuelCardId, releasedAt: null },
    });
    if (held) throw new ConflictException(`Fuel card ${card.cardNumber} is already held. Release it first.`);
  }

  private async holdFuelCard(
    tx: TxClient,
    fuelCardId: string,
    riderId: string,
    vehicleId: string,
    assignmentId: string,
    at: Date,
  ): Promise<void> {
    await tx.fuelCardAssignment.create({ data: { fuelCardId, riderId, vehicleId, assignedAt: at } });
    await tx.fuelCard.update({ where: { id: fuelCardId }, data: { status: 'ASSIGNED' } });
    const card = await tx.fuelCard.findUnique({ where: { id: fuelCardId }, select: { cardNumber: true } });

    await this.history.recordVehicleEvent(tx, {
      vehicleId,
      assignmentId,
      type: 'FUEL_CARD_ASSIGNED',
      summary: `Fuel card ${card?.cardNumber ?? ''} issued with the vehicle`,
      payload: { fuelCardId },
    });
    await this.history.recordRiderEvent(tx, {
      riderId,
      type: 'FUEL_CARD_ASSIGNED',
      summary: `Holds fuel card ${card?.cardNumber ?? ''}`,
      payload: { fuelCardId },
    });
  }

  private async releaseFuelCard(
    tx: TxClient,
    fuelCardId: string,
    vehicleId: string,
    riderId: string,
    at: Date,
  ): Promise<void> {
    // Only the holding that went out with this vehicle and rider. If the card
    // was released and handed to someone else meanwhile, theirs stays open.
    const held = await tx.fuelCardAssignment.findFirst({
      where: { fuelCardId, riderId, vehicleId, releasedAt: null },
    });
    if (!held) return;

    await tx.fuelCardAssignment.update({ where: { id: held.id }, data: { releasedAt: at } });
    await tx.fuelCard.update({ where: { id: fuelCardId }, data: { status: 'AVAILABLE' } });
    const card = await tx.fuelCard.findUnique({ where: { id: fuelCardId }, select: { cardNumber: true } });

    await this.history.recordVehicleEvent(tx, {
      vehicleId,
      type: 'FUEL_CARD_RELEASED',
      summary: `Fuel card ${card?.cardNumber ?? ''} returned`,
      payload: { fuelCardId },
    });
    await this.history.recordRiderEvent(tx, {
      riderId,
      type: 'FUEL_CARD_RELEASED',
      summary: `Returned fuel card ${card?.cardNumber ?? ''}`,
      payload: { fuelCardId },
    });
  }

  /** Riders may look at their own assignments and nothing else. */
  assertVisibleToRider(assignmentRiderId: string, userRiderId: string | null): void {
    if (!userRiderId || assignmentRiderId !== userRiderId) {
      throw new ForbiddenException('You can only view your own records');
    }
  }
}
