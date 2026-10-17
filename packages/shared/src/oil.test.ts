import { describe, expect, it } from 'vitest';
import { calculateOilStatus, OIL_STATUS } from './oil';

describe('calculateOilStatus', () => {
  it('matches the PRD example: 45,000 + 5,000 interval at 48,500 leaves 1,500 km', () => {
    const result = calculateOilStatus({
      currentMileage: 48500,
      lastOilChangeMileage: 45000,
      oilChangeIntervalKm: 5000,
    });
    expect(result.nextChangeMileage).toBe(50000);
    expect(result.remainingKm).toBe(1500);
    expect(result.status).toBe(OIL_STATUS.OK);
  });

  it('warns once inside the warning window', () => {
    const result = calculateOilStatus({
      currentMileage: 49700,
      lastOilChangeMileage: 45000,
      oilChangeIntervalKm: 5000,
    });
    expect(result.status).toBe(OIL_STATUS.DUE_SOON);
    expect(result.remainingKm).toBe(300);
  });

  it('reports overdue with negative remaining kilometres', () => {
    const result = calculateOilStatus({
      currentMileage: 51200,
      lastOilChangeMileage: 45000,
      oilChangeIntervalKm: 5000,
    });
    expect(result.status).toBe(OIL_STATUS.OVERDUE);
    expect(result.remainingKm).toBe(-1200);
  });

  it('is unknown when the vehicle has never had an oil change recorded', () => {
    const result = calculateOilStatus({ currentMileage: 12000, oilChangeIntervalKm: 5000 });
    expect(result.status).toBe(OIL_STATUS.UNKNOWN);
    expect(result.nextChangeMileage).toBeNull();
  });

  it('is unknown when no interval is configured', () => {
    const result = calculateOilStatus({ currentMileage: 12000, lastOilChangeMileage: 9000 });
    expect(result.status).toBe(OIL_STATUS.UNKNOWN);
  });
});
