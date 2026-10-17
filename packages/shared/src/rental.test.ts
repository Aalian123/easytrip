import { describe, expect, it } from 'vitest';
import { billedDaysBetween, calculateRentalCharge, lateDaysBetween, priceDuration } from './rental';

const d = (iso: string) => new Date(iso);

describe('billedDaysBetween', () => {
  it('bills a same-day rental as one day', () => {
    expect(billedDaysBetween(d('2026-09-01T09:00:00Z'), d('2026-09-01T17:00:00Z'))).toBe(1);
  });

  it('rounds a part day up', () => {
    expect(billedDaysBetween(d('2026-09-01T09:00:00Z'), d('2026-09-03T11:00:00Z'))).toBe(3);
  });

  it('never returns less than a day for a reversed range', () => {
    expect(billedDaysBetween(d('2026-09-05T09:00:00Z'), d('2026-09-01T09:00:00Z'))).toBe(1);
  });
});

describe('priceDuration', () => {
  it('bills plain days when only a daily rate exists', () => {
    const lines = priceDuration(7, { dailyRate: 5000 });
    expect(lines).toEqual([{ label: 'Daily rate', quantity: 7, unitAmount: 5000, amount: 35000 }]);
  });

  it('uses the weekly bracket when it beats seven daily charges', () => {
    const lines = priceDuration(9, { dailyRate: 5000, weeklyRate: 28000 });
    expect(lines).toEqual([
      { label: 'Weekly rate', quantity: 1, unitAmount: 28000, amount: 28000 },
      { label: 'Daily rate', quantity: 2, unitAmount: 5000, amount: 10000 },
    ]);
  });

  it('combines monthly, weekly and daily brackets', () => {
    const lines = priceDuration(40, { dailyRate: 5000, weeklyRate: 28000, monthlyRate: 100000 });
    expect(lines.map((l) => [l.label, l.quantity])).toEqual([
      ['Monthly rate', 1],
      ['Weekly rate', 1],
      ['Daily rate', 3],
    ]);
  });

  it('falls back to straight daily billing when brackets cost more', () => {
    const lines = priceDuration(8, { dailyRate: 1000, weeklyRate: 9000 });
    expect(lines).toEqual([{ label: 'Daily rate', quantity: 8, unitAmount: 1000, amount: 8000 }]);
  });
});

describe('lateDaysBetween', () => {
  it('is zero when returned early', () => {
    expect(lateDaysBetween(d('2026-09-10T09:00:00Z'), d('2026-09-09T09:00:00Z'))).toBe(0);
  });

  it('counts a started day as a full late day', () => {
    expect(lateDaysBetween(d('2026-09-10T09:00:00Z'), d('2026-09-11T10:00:00Z'))).toBe(2);
  });

  it('is zero when no return was expected', () => {
    expect(lateDaysBetween(null, d('2026-09-11T10:00:00Z'))).toBe(0);
  });
});

describe('calculateRentalCharge', () => {
  it('matches the PRD example: 7 days at 5,000 is 35,000', () => {
    const result = calculateRentalCharge({
      startAt: d('2026-09-01T09:00:00Z'),
      endAt: d('2026-09-08T09:00:00Z'),
      rates: { dailyRate: 5000 },
    });
    expect(result.billedDays).toBe(7);
    expect(result.total).toBe(35000);
  });

  it('adds extras and late fees, then subtracts the discount', () => {
    const result = calculateRentalCharge({
      startAt: d('2026-09-01T09:00:00Z'),
      endAt: d('2026-09-08T09:00:00Z'),
      expectedReturnAt: d('2026-09-06T09:00:00Z'),
      rates: { dailyRate: 5000, lateReturnFeePerDay: 1500 },
      extras: { fuelCharge: 2000, damageCharge: 4000, trafficFines: 1000, discount: 3000 },
    });
    expect(result.lateDays).toBe(2);
    expect(result.lateFee).toBe(3000);
    expect(result.additionalCharges).toBe(7000);
    // 35000 base + 3000 late + 7000 extras - 3000 discount
    expect(result.total).toBe(42000);
  });

  it('never returns a negative total', () => {
    const result = calculateRentalCharge({
      startAt: d('2026-09-01T09:00:00Z'),
      endAt: d('2026-09-02T09:00:00Z'),
      rates: { dailyRate: 1000 },
      extras: { discount: 99999 },
    });
    expect(result.total).toBe(0);
  });
});
