/**
 * Fuel card limit checks (FR-17, BR-10).
 *
 * Limits are rolling windows anchored on the transaction being evaluated, so a
 * card is judged on what it actually spent in the preceding day/week/month
 * rather than on calendar boundaries.
 */

export interface FuelLimits {
  dailyLimit?: number | null;
  weeklyLimit?: number | null;
  monthlyLimit?: number | null;
}

export interface FuelSpendEntry {
  occurredAt: Date;
  amount: number;
}

export type FuelWindow = 'daily' | 'weekly' | 'monthly';

export interface FuelWindowUsage {
  window: FuelWindow;
  limit: number | null;
  used: number;
  remaining: number | null;
  exceeded: boolean;
}

export interface FuelUsageResult {
  windows: FuelWindowUsage[];
  exceeded: FuelWindow[];
  flagged: boolean;
  flagReason: string | null;
}

const WINDOW_DAYS: Record<FuelWindow, number> = { daily: 1, weekly: 7, monthly: 30 };

function sumWithin(entries: FuelSpendEntry[], at: Date, days: number): number {
  const from = at.getTime() - days * 24 * 60 * 60 * 1000;
  return entries
    .filter((e) => e.occurredAt.getTime() > from && e.occurredAt.getTime() <= at.getTime())
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Evaluate a candidate transaction against a card's limits.
 * `history` should hold the card's existing transactions; the candidate is
 * included in the totals so the check answers "would this purchase break a
 * limit", not "did the last one".
 */
export function evaluateFuelLimits(
  candidate: FuelSpendEntry,
  history: FuelSpendEntry[],
  limits: FuelLimits,
): FuelUsageResult {
  const entries = [...history, candidate];
  const configured: Record<FuelWindow, number | null> = {
    daily: limits.dailyLimit ?? null,
    weekly: limits.weeklyLimit ?? null,
    monthly: limits.monthlyLimit ?? null,
  };

  const windows = (Object.keys(WINDOW_DAYS) as FuelWindow[]).map<FuelWindowUsage>((window) => {
    const used = Math.round(sumWithin(entries, candidate.occurredAt, WINDOW_DAYS[window]) * 100) / 100;
    const limit = configured[window];
    return {
      window,
      limit,
      used,
      remaining: limit === null ? null : Math.round((limit - used) * 100) / 100,
      exceeded: limit !== null && used > limit,
    };
  });

  const exceeded = windows.filter((w) => w.exceeded).map((w) => w.window);
  const flagReason = exceeded.length
    ? exceeded
        .map((w) => {
          const usage = windows.find((x) => x.window === w)!;
          return `${w} limit exceeded (${usage.used} of ${usage.limit})`;
        })
        .join('; ')
    : null;

  return { windows, exceeded, flagged: exceeded.length > 0, flagReason };
}
