import { describe, expect, it } from 'vitest';
import { FeatureKey, resolveFeaturesFromEnv } from './features';

describe('resolveFeaturesFromEnv', () => {
  it('switches everything on when nothing is set', () => {
    const map = resolveFeaturesFromEnv({});
    expect(map[FeatureKey.ASSIGNMENTS]).toBe(true);
    expect(map[FeatureKey.REPORTS]).toBe(true);
  });

  it('shows only the listed features', () => {
    const map = resolveFeaturesFromEnv({ FEATURES: 'fleet,riders,assignments,inspections' });
    expect(map[FeatureKey.ASSIGNMENTS]).toBe(true);
    expect(map[FeatureKey.INSPECTIONS]).toBe(true);
    expect(map[FeatureKey.REPORTS]).toBe(false);
    expect(map[FeatureKey.FUEL_CARDS]).toBe(false);
  });

  it('treats "all" as everything on', () => {
    const map = resolveFeaturesFromEnv({ FEATURES: 'all' });
    expect(map[FeatureKey.PAYMENTS]).toBe(true);
  });

  it('lets a single variable override the list', () => {
    const map = resolveFeaturesFromEnv({ FEATURES: 'fleet,riders', FEATURE_REPORTS: 'true' });
    expect(map[FeatureKey.REPORTS]).toBe(true);
    expect(map[FeatureKey.MAINTENANCE]).toBe(false);
  });

  it('accepts the usual ways of writing yes and no', () => {
    expect(resolveFeaturesFromEnv({ FEATURE_INCIDENTS: 'off' })[FeatureKey.INCIDENTS]).toBe(false);
    expect(resolveFeaturesFromEnv({ FEATURE_INCIDENTS: '0' })[FeatureKey.INCIDENTS]).toBe(false);
    expect(resolveFeaturesFromEnv({ FEATURE_INCIDENTS: 'yes' })[FeatureKey.INCIDENTS]).toBe(true);
    // Anything it cannot read leaves the default alone.
    expect(resolveFeaturesFromEnv({ FEATURE_INCIDENTS: 'maybe' })[FeatureKey.INCIDENTS]).toBe(true);
  });

  it('keeps the fleet and the riders on whatever the environment says', () => {
    const map = resolveFeaturesFromEnv({ FEATURE_FLEET: 'false', FEATURE_RIDERS: 'off', FEATURES: 'reports' });
    expect(map[FeatureKey.FLEET]).toBe(true);
    expect(map[FeatureKey.RIDERS]).toBe(true);
  });

  it('drops a feature whose dependency was left out', () => {
    const map = resolveFeaturesFromEnv({ FEATURES: 'fleet,riders,payments' });
    // Payments needs rental charges, which needs handovers — none were listed.
    expect(map[FeatureKey.PAYMENTS]).toBe(false);
    expect(map[FeatureKey.RENTALS]).toBe(false);
  });

  it('drops fuel purchases when only the cards are asked for', () => {
    const map = resolveFeaturesFromEnv({ FEATURES: 'fleet,riders,fuelTransactions' });
    expect(map[FeatureKey.FUEL_TRANSACTIONS]).toBe(false);
  });
});
