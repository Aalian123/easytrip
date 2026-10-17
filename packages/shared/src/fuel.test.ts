import { describe, expect, it } from 'vitest';
import { evaluateFuelLimits } from './fuel';

const at = (iso: string) => new Date(iso);

describe('evaluateFuelLimits', () => {
  const limits = { dailyLimit: 5000, weeklyLimit: 20000, monthlyLimit: 60000 };

  it('passes a purchase inside every limit', () => {
    const result = evaluateFuelLimits({ occurredAt: at('2026-09-08T10:00:00Z'), amount: 3000 }, [], limits);
    expect(result.flagged).toBe(false);
    expect(result.windows.find((w) => w.window === 'daily')?.remaining).toBe(2000);
  });

  it('flags the daily window when the candidate pushes it over', () => {
    const history = [{ occurredAt: at('2026-09-08T06:00:00Z'), amount: 4000 }];
    const result = evaluateFuelLimits({ occurredAt: at('2026-09-08T18:00:00Z'), amount: 2000 }, history, limits);
    expect(result.exceeded).toContain('daily');
    expect(result.flagReason).toContain('daily limit exceeded');
  });

  it('ignores spend older than the window', () => {
    const history = [{ occurredAt: at('2026-08-01T06:00:00Z'), amount: 50000 }];
    const result = evaluateFuelLimits({ occurredAt: at('2026-09-08T18:00:00Z'), amount: 1000 }, history, limits);
    expect(result.flagged).toBe(false);
  });

  it('treats an unset limit as unlimited', () => {
    const result = evaluateFuelLimits(
      { occurredAt: at('2026-09-08T10:00:00Z'), amount: 999999 },
      [],
      { dailyLimit: null, weeklyLimit: null, monthlyLimit: null },
    );
    expect(result.flagged).toBe(false);
    expect(result.windows.every((w) => w.remaining === null)).toBe(true);
  });
});
