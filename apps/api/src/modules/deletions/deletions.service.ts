import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DELETION_KINDS,
  DeletionImpact,
  DeletionKind,
  DeletionPreview,
  FEATURE_INDEX,
  FeatureKey,
} from '@easytrip/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { FeaturesService } from '../features/features.service';
import { currentContext } from '../../context/request-context';

type Tx = Prisma.TransactionClient;

interface Plan {
  label: string;
  /** Model name and product module, for the audit entry. */
  recordType: string;
  module: string;
  confirmText: string | null;
  blockedReason: string | null;
  deletes: DeletionImpact[];
  keeps: DeletionImpact[];
  notes: string[];
  /** The record as it was, kept in the audit trail after it is gone. */
  snapshot: unknown;
  /** Whether the deletion reaches append-only history and must lift the triggers. */
  touchesHistory: boolean;
}

interface Definition {
  feature: FeatureKey | null;
  plan(tx: Tx, id: string): Promise<Plan>;
  execute(tx: Tx, id: string): Promise<void>;
}

const TIMELINE_NOTE = 'Entries on other timelines that mention it stay as they were written.';
const AUDIT_NOTE = 'The audit log keeps a copy of the deleted record and who deleted it.';

/**
 * The only code that deletes a record together with its history.
 *
 * Every other write in the platform is append-only for history, enforced by
 * database triggers. A deletion here runs in one transaction that switches on
 * `easytrip.purge` for itself alone, removes the record and everything that
 * belongs to it, and writes the deletion to the audit trail, which itself can
 * never be deleted.
 */
@Injectable()
export class DeletionsService {
  constructor(
    private readonly raw: PrismaService,
    private readonly features: FeaturesService,
  ) {}

  async preview(kind: string, id: string): Promise<DeletionPreview> {
    const definition = this.definition(kind);
    const plan = await definition.plan(this.raw, id);
    return {
      kind: kind as DeletionKind,
      id,
      label: plan.label,
      confirmText: plan.confirmText,
      blockedReason: plan.blockedReason,
      deletes: plan.deletes.filter((impact) => impact.count > 0),
      keeps: plan.keeps.filter((impact) => impact.count > 0),
      notes: plan.notes,
    };
  }

  async remove(kind: string, id: string) {
    const definition = this.definition(kind);
    const ctx = currentContext();

    return this.raw.$transaction(
      async (tx) => {
        // Planned again inside the transaction: the preview may be stale.
        const plan = await definition.plan(tx, id);
        if (plan.blockedReason) throw new ConflictException(plan.blockedReason);

        if (plan.touchesHistory) {
          await tx.$queryRaw`SELECT set_config('easytrip.purge', 'on', true)`;
        }
        await definition.execute(tx, id);

        const deletes = plan.deletes.filter((impact) => impact.count > 0);
        const keeps = plan.keeps.filter((impact) => impact.count > 0);
        await tx.auditLog.create({
          data: {
            userId: ctx.userId ?? null,
            userLabel: ctx.userLabel ?? 'system',
            action: 'deleted',
            module: plan.module,
            recordType: plan.recordType,
            recordId: id,
            before: json({ record: plan.snapshot, deletedWithIt: deletes, keptUnlinked: keeps }),
            after: Prisma.JsonNull,
          },
        });

        return { deleted: true, label: plan.label, deletes };
      },
      { timeout: 30_000 },
    );
  }

  private definition(kind: string): Definition {
    if (!DELETION_KINDS.includes(kind as DeletionKind)) {
      throw new BadRequestException(`Nothing called "${kind}" can be deleted.`);
    }
    const definition = DEFINITIONS[kind as DeletionKind];
    if (definition.feature && !this.features.isEnabled(definition.feature)) {
      const feature = FEATURE_INDEX.get(definition.feature);
      throw new ForbiddenException(
        `${feature?.name ?? definition.feature} is not switched on. Set ${feature?.envVar ?? definition.feature}=true in .env and restart the API.`,
      );
    }
    return definition;
  }
}

// ---------------------------------------------------------------- definitions

const DEFINITIONS: Record<DeletionKind, Definition> = {
  vehicle: {
    feature: FeatureKey.FLEET,
    async plan(tx, id) {
      const vehicle = await tx.vehicle.findUnique({ where: { id } });
      if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');

      const active = await tx.vehicleAssignment.findFirst({
        where: { vehicleId: id, status: 'ACTIVE' },
        include: { rider: { select: { fullName: true } } },
      });
      const heldCard = await tx.fuelCardAssignment.findFirst({
        where: { vehicleId: id, releasedAt: null },
        include: { fuelCard: { select: { cardNumber: true } } },
      });
      const assignmentIds = await assignmentIdsWhere(tx, { vehicleId: id });

      return {
        label: `${vehicle.make} ${vehicle.model} (${vehicle.registration})`,
        recordType: 'Vehicle',
        module: 'Fleet',
        confirmText: vehicle.registration,
        blockedReason: active
          ? `${vehicle.registration} is out with ${active.rider.fullName}. Record its return before deleting it.`
          : heldCard
            ? `${vehicle.registration} holds fuel card ${heldCard.fuelCard.cardNumber}. Release the card first.`
            : null,
        deletes: [
          { label: 'Timeline entries', count: await tx.vehicleEvent.count({ where: { vehicleId: id } }) },
          { label: 'Assignments', count: assignmentIds.length },
          { label: 'Handover and return inspections', count: await tx.inspection.count({ where: { vehicleId: id } }) },
          { label: 'Rental charges', count: await tx.rentalCharge.count({ where: { vehicleId: id } }) },
          { label: 'Rental rates', count: await tx.rentalRate.count({ where: { vehicleId: id } }) },
          { label: 'Damage records', count: await tx.damage.count({ where: { vehicleId: id } }) },
          { label: 'Accidents', count: await tx.accident.count({ where: { vehicleId: id } }) },
          { label: 'Maintenance records', count: await tx.maintenanceRecord.count({ where: { vehicleId: id } }) },
          { label: 'Reservations', count: await tx.reservation.count({ where: { vehicleId: id } }) },
          { label: 'Documents', count: await tx.document.count({ where: { ownerType: 'VEHICLE', ownerId: id } }) },
          { label: 'Photo and video links', count: await tx.mediaLink.count({ where: vehicleMediaWhere(id) }) },
          { label: 'Alerts', count: await tx.notification.count({ where: alertsWhere('Vehicle', id, assignmentIds) }) },
        ],
        keeps: [
          { label: 'Fuel purchases (stay on their fuel card)', count: await tx.fuelTransaction.count({ where: { vehicleId: id } }) },
          { label: 'Fuel card holdings (stay on the card history)', count: await tx.fuelCardAssignment.count({ where: { vehicleId: id } }) },
          {
            label: "Other vehicles' damage records linked to its accidents",
            count: await tx.damage.count({ where: { accident: { vehicleId: id }, vehicleId: { not: id } } }),
          },
        ],
        notes: ["Riders keep their own history entries about this vehicle.", AUDIT_NOTE],
        snapshot: vehicle,
        touchesHistory: true,
      };
    },
    async execute(tx, id) {
      const assignmentIds = await assignmentIdsWhere(tx, { vehicleId: id });
      await tx.notification.deleteMany({ where: alertsWhere('Vehicle', id, assignmentIds) });
      await tx.document.deleteMany({ where: { ownerType: 'VEHICLE', ownerId: id } });
      await tx.rentalCharge.deleteMany({ where: { vehicleId: id } });
      await tx.inspection.deleteMany({ where: { vehicleId: id } });
      await tx.damage.deleteMany({ where: { vehicleId: id } });
      await tx.accident.deleteMany({ where: { vehicleId: id } });
      await tx.maintenanceRecord.deleteMany({ where: { vehicleId: id } });
      await tx.vehicleAssignment.deleteMany({ where: { vehicleId: id } });
      // Rates, reservations, media links and the timeline go with the vehicle.
      await tx.vehicle.delete({ where: { id } });
    },
  },

  rider: {
    feature: FeatureKey.RIDERS,
    async plan(tx, id) {
      const rider = await tx.rider.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
      if (!rider) throw new NotFoundException('That rider no longer exists.');

      const active = await tx.vehicleAssignment.findFirst({
        where: { riderId: id, status: 'ACTIVE' },
        include: { vehicle: { select: { registration: true } } },
      });
      const heldCard = await tx.fuelCardAssignment.findFirst({
        where: { riderId: id, releasedAt: null },
        include: { fuelCard: { select: { cardNumber: true } } },
      });
      const assignmentIds = await assignmentIdsWhere(tx, { riderId: id });

      return {
        label: rider.fullName,
        recordType: 'Rider',
        module: 'Riders',
        confirmText: rider.fullName,
        blockedReason: active
          ? `${rider.fullName} has ${active.vehicle.registration} out. Record its return before deleting them.`
          : heldCard
            ? `${rider.fullName} holds fuel card ${heldCard.fuelCard.cardNumber}. Release the card first.`
            : null,
        deletes: [
          { label: 'Rider history entries', count: await tx.riderEvent.count({ where: { riderId: id } }) },
          { label: 'Assignments', count: assignmentIds.length },
          {
            label: 'Handover and return inspections',
            count: await tx.inspection.count({ where: { assignment: { riderId: id } } }),
          },
          { label: 'Rental charges', count: await tx.rentalCharge.count({ where: { assignment: { riderId: id } } }) },
          { label: 'Documents', count: await tx.document.count({ where: { ownerType: 'RIDER', ownerId: id } }) },
          { label: 'Photo and video links', count: await tx.mediaLink.count({ where: riderMediaWhere(id) }) },
          { label: `Sign-in account${rider.user ? ` (${rider.user.email})` : ''}`, count: rider.user ? 1 : 0 },
          { label: 'Alerts', count: await tx.notification.count({ where: alertsWhere('Rider', id, assignmentIds) }) },
        ],
        keeps: [
          {
            label: "Vehicle timeline entries for their assignments (stay on each vehicle)",
            count: await tx.vehicleEvent.count({ where: { assignmentId: { in: assignmentIds } } }),
          },
          { label: 'Damage records (stay on the vehicle)', count: await tx.damage.count({ where: { riderId: id } }) },
          { label: 'Accidents (stay on the vehicle)', count: await tx.accident.count({ where: { riderId: id } }) },
          { label: 'Fuel purchases', count: await tx.fuelTransaction.count({ where: { riderId: id } }) },
          { label: 'Fuel card holdings', count: await tx.fuelCardAssignment.count({ where: { riderId: id } }) },
          { label: 'Reservations', count: await tx.reservation.count({ where: { riderId: id } }) },
        ],
        notes: [TIMELINE_NOTE, AUDIT_NOTE],
        snapshot: rider,
        touchesHistory: true,
      };
    },
    async execute(tx, id) {
      const assignmentIds = await assignmentIdsWhere(tx, { riderId: id });
      await tx.notification.deleteMany({ where: alertsWhere('Rider', id, assignmentIds) });
      await tx.document.deleteMany({ where: { ownerType: 'RIDER', ownerId: id } });
      // A rider login is meaningless without its rider profile.
      await tx.user.deleteMany({ where: { riderId: id } });
      await tx.rentalCharge.deleteMany({ where: { assignment: { riderId: id } } });
      await tx.inspection.deleteMany({ where: { assignment: { riderId: id } } });
      await tx.vehicleAssignment.deleteMany({ where: { riderId: id } });
      // Their history entries and media links go with the rider.
      await tx.rider.delete({ where: { id } });
    },
  },

  'fuel-card': {
    feature: FeatureKey.FUEL_CARDS,
    async plan(tx, id) {
      const card = await tx.fuelCard.findUnique({ where: { id } });
      if (!card) throw new NotFoundException('That fuel card no longer exists.');

      const held = await tx.fuelCardAssignment.count({ where: { fuelCardId: id, releasedAt: null } });
      const transactionIds = (
        await tx.fuelTransaction.findMany({ where: { fuelCardId: id }, select: { id: true } })
      ).map((row) => row.id);

      return {
        label: `Fuel card ${card.cardNumber}`,
        recordType: 'FuelCard',
        module: 'Fuel',
        confirmText: card.cardNumber,
        blockedReason: held ? `Fuel card ${card.cardNumber} is issued. Release it before deleting it.` : null,
        deletes: [
          { label: 'Holding history', count: await tx.fuelCardAssignment.count({ where: { fuelCardId: id } }) },
          { label: 'Fuel purchases', count: transactionIds.length },
          { label: 'Alerts', count: await tx.notification.count({ where: fuelAlertsWhere(id, transactionIds) }) },
        ],
        keeps: [
          {
            label: 'Assignments that used this card',
            count: await tx.vehicleAssignment.count({ where: { fuelCardId: id } }),
          },
        ],
        notes: [TIMELINE_NOTE, AUDIT_NOTE],
        snapshot: card,
        touchesHistory: false,
      };
    },
    async execute(tx, id) {
      const transactionIds = (
        await tx.fuelTransaction.findMany({ where: { fuelCardId: id }, select: { id: true } })
      ).map((row) => row.id);
      await tx.notification.deleteMany({ where: fuelAlertsWhere(id, transactionIds) });
      await tx.fuelTransaction.deleteMany({ where: { fuelCardId: id } });
      await tx.fuelCard.delete({ where: { id } });
    },
  },

  damage: {
    feature: FeatureKey.INCIDENTS,
    async plan(tx, id) {
      const damage = await tx.damage.findUnique({
        where: { id },
        include: { vehicle: { select: { registration: true } } },
      });
      if (!damage) throw new NotFoundException('That damage record no longer exists.');

      return {
        label: `${sentence(damage.severity)} ${sentence(damage.category).toLowerCase()} on ${damage.vehicle.registration}`,
        recordType: 'Damage',
        module: 'Incidents',
        confirmText: null,
        blockedReason: null,
        deletes: [{ label: 'Photo and video links', count: await tx.mediaLink.count({ where: { damageId: id } }) }],
        keeps: [],
        notes: [TIMELINE_NOTE, AUDIT_NOTE],
        snapshot: damage,
        touchesHistory: false,
      };
    },
    async execute(tx, id) {
      await tx.damage.delete({ where: { id } });
    },
  },

  accident: {
    feature: FeatureKey.INCIDENTS,
    async plan(tx, id) {
      const accident = await tx.accident.findUnique({
        where: { id },
        include: { vehicle: { select: { registration: true } } },
      });
      if (!accident) throw new NotFoundException('That accident no longer exists.');

      return {
        label: `Accident ${accident.reference} (${accident.vehicle.registration})`,
        recordType: 'Accident',
        module: 'Incidents',
        confirmText: accident.reference,
        blockedReason: null,
        deletes: [{ label: 'Photo and video links', count: await tx.mediaLink.count({ where: { accidentId: id } }) }],
        keeps: [{ label: 'Damage records from it', count: await tx.damage.count({ where: { accidentId: id } }) }],
        notes: [TIMELINE_NOTE, AUDIT_NOTE],
        snapshot: accident,
        touchesHistory: false,
      };
    },
    async execute(tx, id) {
      await tx.accident.delete({ where: { id } });
    },
  },

  user: {
    feature: null,
    async plan(tx, id) {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('That user no longer exists.');
      const { passwordHash: _secret, ...snapshot } = user;

      return {
        label: `${user.name} (${user.email})`,
        recordType: 'User',
        module: 'Users',
        confirmText: user.email,
        blockedReason: currentContext().userId === id ? 'You cannot delete your own account.' : null,
        deletes: [
          { label: 'Signed-in sessions', count: await tx.refreshToken.count({ where: { userId: id } }) },
          { label: 'Alerts addressed to them', count: await tx.notification.count({ where: { targetUserId: id } }) },
        ],
        keeps: [
          { label: 'Audit log entries (keep their name)', count: await tx.auditLog.count({ where: { userId: id } }) },
          {
            label: 'Timeline entries they recorded',
            count:
              (await tx.vehicleEvent.count({ where: { actorId: id } })) +
              (await tx.riderEvent.count({ where: { actorId: id } })),
          },
          {
            label: 'Documents and links they added',
            count:
              (await tx.document.count({ where: { addedById: id } })) +
              (await tx.mediaLink.count({ where: { uploadedById: id } })),
          },
        ],
        notes: [
          ...(user.riderId ? ['Their rider profile is not deleted. Delete the rider to remove it.'] : []),
          AUDIT_NOTE,
        ],
        snapshot,
        // Detaching them from the timelines and audit trail edits history rows.
        touchesHistory: true,
      };
    },
    async execute(tx, id) {
      await tx.user.delete({ where: { id } });
    },
  },

  document: {
    feature: FeatureKey.DOCUMENTS,
    async plan(tx, id) {
      const document = await tx.document.findUnique({ where: { id } });
      if (!document) throw new NotFoundException('That document no longer exists.');
      return {
        label: document.title,
        recordType: 'Document',
        module: 'Documents',
        confirmText: null,
        blockedReason: null,
        deletes: [],
        keeps: [],
        notes: ['Only the link is removed. The file stays in the drive it lives in.', AUDIT_NOTE],
        snapshot: document,
        touchesHistory: false,
      };
    },
    async execute(tx, id) {
      // Expiry alerts point at the owner, so they are found by the key that names the document.
      await tx.notification.deleteMany({ where: { dedupeKey: { startsWith: `document:${id}:` } } });
      await tx.document.delete({ where: { id } });
    },
  },

  media: {
    feature: null,
    async plan(tx, id) {
      const link = await tx.mediaLink.findUnique({ where: { id } });
      if (!link) throw new NotFoundException('That link no longer exists.');
      return {
        label: link.description || link.url,
        recordType: 'MediaLink',
        module: 'Media',
        confirmText: null,
        blockedReason: null,
        deletes: [],
        keeps: [],
        notes: ['Only the link is removed. The file stays in the drive it lives in.', AUDIT_NOTE],
        snapshot: link,
        touchesHistory: false,
      };
    },
    async execute(tx, id) {
      await tx.mediaLink.delete({ where: { id } });
    },
  },
};

// ---------------------------------------------------------------- helpers

async function assignmentIdsWhere(tx: Tx, where: Prisma.VehicleAssignmentWhereInput): Promise<string[]> {
  const rows = await tx.vehicleAssignment.findMany({ where, select: { id: true } });
  return rows.map((row) => row.id);
}

/** Links on the vehicle itself and on anything of its that is being deleted. */
function vehicleMediaWhere(vehicleId: string): Prisma.MediaLinkWhereInput {
  return {
    OR: [
      { vehicleId },
      { assignment: { vehicleId } },
      { inspection: { vehicleId } },
      { damage: { vehicleId } },
      { accident: { vehicleId } },
      { maintenance: { vehicleId } },
    ],
  };
}

function riderMediaWhere(riderId: string): Prisma.MediaLinkWhereInput {
  return {
    OR: [{ riderId }, { assignment: { riderId } }, { inspection: { assignment: { riderId } } }],
  };
}

function alertsWhere(entityType: string, id: string, assignmentIds: string[]): Prisma.NotificationWhereInput {
  return {
    OR: [
      { entityType, entityId: id },
      { entityType: 'VehicleAssignment', entityId: { in: assignmentIds } },
    ],
  };
}

function fuelAlertsWhere(cardId: string, transactionIds: string[]): Prisma.NotificationWhereInput {
  return {
    OR: [
      { entityType: 'FuelCard', entityId: cardId },
      { entityType: 'FuelTransaction', entityId: { in: transactionIds } },
    ],
  };
}

function sentence(value: string): string {
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val)),
  );
}
