import { Prisma, PrismaClient } from '@prisma/client';
import { currentContext } from '../context/request-context';

/** Models whose writes are worth keeping a before/after record of (FR-24). */
const TRACKED_MODELS = new Set([
  'Vehicle',
  'Rider',
  'User',
  'VehicleAssignment',
  'Inspection',
  'Damage',
  'Accident',
  'MaintenanceRecord',
  'FuelCard',
  'FuelCardAssignment',
  'FuelTransaction',
  'RentalRate',
  'RentalCharge',
  'Document',
  'MediaLink',
  'Reservation',
  'Settings',
]);

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const ACTION_LABELS: Record<string, string> = {
  create: 'created',
  createMany: 'created',
  update: 'updated',
  updateMany: 'updated',
  upsert: 'saved',
  delete: 'deleted',
  deleteMany: 'deleted',
};

function serialise(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val instanceof Date ? val.toISOString() : val,
    ),
  );
}

/** Fields that must never be copied into the audit trail. */
const REDACTED = new Set(['passwordHash', 'tokenHash']);

function redact(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED.has(key) ? '[redacted]' : redact(val);
  }
  return out;
}

/**
 * Writes an AuditLog row for every tracked mutation, capturing the previous
 * state before the change lands. This is the only write path to AuditLog —
 * the table itself rejects updates and deletes at the database level.
 */
export function withAudit(base: PrismaClient) {
  return base.$extends({
    name: 'easytrip-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TRACKED_MODELS.has(model) || !WRITE_OPERATIONS.has(operation)) {
            return query(args);
          }

          const delegate = (base as any)[model.charAt(0).toLowerCase() + model.slice(1)];
          const where = (args as any)?.where;

          let before: unknown = null;
          if (where && ['update', 'delete', 'upsert'].includes(operation)) {
            before = await delegate.findUnique({ where }).catch(() => null);
          } else if (where && ['updateMany', 'deleteMany'].includes(operation)) {
            before = await delegate.findMany({ where, take: 25 }).catch(() => null);
          }

          const result = await query(args);

          const ctx = currentContext();
          const recordId =
            (result as any)?.id ?? (before as any)?.id ?? (where as any)?.id ?? null;

          await base.auditLog.create({
            data: {
              userId: ctx.userId ?? null,
              userLabel: ctx.userLabel ?? 'system',
              action: ACTION_LABELS[operation] ?? operation,
              module: ctx.module ?? model,
              recordType: model,
              recordId: typeof recordId === 'string' ? recordId : null,
              before: before ? serialise(redact(before)) : Prisma.JsonNull,
              after: result ? serialise(redact(result)) : Prisma.JsonNull,
            },
          });

          return result;
        },
      },
    },
  });
}
