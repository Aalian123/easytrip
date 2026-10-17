/**
 * Rental maths (FR-11, FR-12).
 *
 * Imported by both the API and the web app so a quote shown on screen and the
 * charge written to the database are produced by the same code.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RentalRates {
  dailyRate: number;
  weeklyRate?: number | null;
  monthlyRate?: number | null;
  lateReturnFeePerDay?: number | null;
}

export interface RentalExtras {
  fuelCharge?: number;
  damageCharge?: number;
  trafficFines?: number;
  otherCharges?: number;
  discount?: number;
}

export interface RentalLine {
  label: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface RentalBreakdown {
  billedDays: number;
  lateDays: number;
  lines: RentalLine[];
  baseAmount: number;
  lateFee: number;
  additionalCharges: number;
  discount: number;
  total: number;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Whole days between two instants, rounded up, never below 1 — a vehicle taken
 * out and returned the same afternoon is still a day's rental.
 */
export function billedDaysBetween(startAt: Date, endAt: Date): number {
  const ms = endAt.getTime() - startAt.getTime();
  if (ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

export function lateDaysBetween(expectedReturnAt: Date | null | undefined, endAt: Date): number {
  if (!expectedReturnAt) return 0;
  const ms = endAt.getTime() - expectedReturnAt.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

/**
 * Decompose a duration into the cheapest combination of monthly, weekly and
 * daily brackets the vehicle actually has rates for. A 35-day rental on a
 * vehicle with a monthly rate bills one month plus five days, not 35 days —
 * unless plain daily billing works out cheaper, in which case the renter gets
 * the lower figure.
 */
export function priceDuration(days: number, rates: RentalRates): RentalLine[] {
  const daily = rates.dailyRate;
  const weekly = rates.weeklyRate ?? null;
  const monthly = rates.monthlyRate ?? null;

  const lines: RentalLine[] = [];
  let remaining = days;

  if (monthly && monthly > 0) {
    const months = Math.floor(remaining / 30);
    if (months > 0) {
      lines.push({ label: 'Monthly rate', quantity: months, unitAmount: monthly, amount: round2(months * monthly) });
      remaining -= months * 30;
    }
  }
  if (weekly && weekly > 0) {
    const weeks = Math.floor(remaining / 7);
    if (weeks > 0) {
      lines.push({ label: 'Weekly rate', quantity: weeks, unitAmount: weekly, amount: round2(weeks * weekly) });
      remaining -= weeks * 7;
    }
  }
  if (remaining > 0) {
    lines.push({ label: 'Daily rate', quantity: remaining, unitAmount: daily, amount: round2(remaining * daily) });
  }

  const bracketed = lines.reduce((sum, line) => sum + line.amount, 0);
  const straightDaily = round2(days * daily);

  if (straightDaily <= bracketed || lines.length === 0) {
    return [{ label: 'Daily rate', quantity: days, unitAmount: daily, amount: straightDaily }];
  }
  return lines;
}

export interface RentalChargeInput {
  startAt: Date;
  endAt: Date;
  expectedReturnAt?: Date | null;
  rates: RentalRates;
  extras?: RentalExtras;
}

/** Subtotal + additional charges − discounts = final amount (PRD §17). */
export function calculateRentalCharge(input: RentalChargeInput): RentalBreakdown {
  const billedDays = billedDaysBetween(input.startAt, input.endAt);
  const lines = priceDuration(billedDays, input.rates);
  const baseAmount = round2(lines.reduce((sum, line) => sum + line.amount, 0));

  const lateDays = lateDaysBetween(input.expectedReturnAt, input.endAt);
  const lateFee = round2(lateDays * (input.rates.lateReturnFeePerDay ?? 0));

  const extras = input.extras ?? {};
  const additionalCharges = round2(
    (extras.fuelCharge ?? 0) +
      (extras.damageCharge ?? 0) +
      (extras.trafficFines ?? 0) +
      (extras.otherCharges ?? 0),
  );
  const discount = round2(extras.discount ?? 0);
  const total = round2(Math.max(0, baseAmount + lateFee + additionalCharges - discount));

  return { billedDays, lateDays, lines, baseAmount, lateFee, additionalCharges, discount, total };
}
