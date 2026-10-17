/**
 * Engine oil interval tracking (FR-14).
 *
 * Mileage-driven, not date-driven: a vehicle standing idle for a month does not
 * need an oil change, one doing 400 km a day does.
 */

export const OIL_STATUS = {
  UNKNOWN: 'UNKNOWN',
  OK: 'OK',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
} as const;
export type OilStatus = (typeof OIL_STATUS)[keyof typeof OIL_STATUS];

export interface OilStatusInput {
  currentMileage: number;
  lastOilChangeMileage?: number | null;
  oilChangeIntervalKm?: number | null;
  /** How many kilometres ahead of the due point to start warning. */
  warnWithinKm?: number;
}

export interface OilStatusResult {
  status: OilStatus;
  nextChangeMileage: number | null;
  remainingKm: number | null;
  intervalKm: number | null;
}

export const DEFAULT_OIL_WARN_KM = 500;

export function calculateOilStatus(input: OilStatusInput): OilStatusResult {
  const interval = input.oilChangeIntervalKm ?? null;
  const last = input.lastOilChangeMileage ?? null;

  if (!interval || interval <= 0 || last === null) {
    return { status: OIL_STATUS.UNKNOWN, nextChangeMileage: null, remainingKm: null, intervalKm: interval };
  }

  const nextChangeMileage = last + interval;
  const remainingKm = nextChangeMileage - input.currentMileage;
  const warnWithin = input.warnWithinKm ?? DEFAULT_OIL_WARN_KM;

  const status: OilStatus =
    remainingKm <= 0 ? OIL_STATUS.OVERDUE : remainingKm <= warnWithin ? OIL_STATUS.DUE_SOON : OIL_STATUS.OK;

  return { status, nextChangeMileage, remainingKm, intervalKm: interval };
}
