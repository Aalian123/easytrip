/**
 * What the platform can do, split into pieces that can be switched on one at a
 * time.
 *
 * The point is a calm rollout: a fleet that has never used software should not
 * meet nineteen menus on day one. Each feature names what it needs before it
 * makes sense, and carries the step it belongs to, so the order below is the
 * order to turn things on.
 */

export const FeatureKey = {
  FLEET: 'fleet',
  RIDERS: 'riders',
  DOCUMENTS: 'documents',
  ASSIGNMENTS: 'assignments',
  INSPECTIONS: 'inspections',
  INCIDENTS: 'incidents',
  MAINTENANCE: 'maintenance',
  FUEL_CARDS: 'fuelCards',
  FUEL_TRANSACTIONS: 'fuelTransactions',
  RENTALS: 'rentals',
  PAYMENTS: 'payments',
  ALERTS: 'alerts',
  REPORTS: 'reports',
  AUDIT: 'audit',
} as const;
export type FeatureKey = (typeof FeatureKey)[keyof typeof FeatureKey];

export interface FeatureDefinition {
  key: FeatureKey;
  /** What an operator would call it. */
  name: string;
  /** What switching it on gives them, in one line. */
  summary: string;
  /** The rollout step. Lower steps are switched on first. */
  step: number;
  stepName: string;
  /** Must already be on for this to make sense. */
  requires: FeatureKey[];
  /** On unless the environment says otherwise. */
  defaultEnabled: boolean;
  /** Every screen assumes these exist, so the environment cannot remove them. */
  locked?: boolean;
  /** The environment variable that controls this one. */
  envVar: string;
}

export const FEATURES: FeatureDefinition[] = [
  {
    key: FeatureKey.FLEET,
    envVar: 'FEATURE_FLEET',
    name: 'Vehicles',
    summary: 'The vehicle list, statuses and the fleet overview.',
    step: 1,
    stepName: 'Get the fleet on the books',
    requires: [],
    defaultEnabled: true,
    locked: true,
  },
  {
    key: FeatureKey.RIDERS,
    envVar: 'FEATURE_RIDERS',
    name: 'Riders',
    summary: 'Rider profiles, licences and their history.',
    step: 1,
    stepName: 'Get the fleet on the books',
    requires: [],
    defaultEnabled: true,
    locked: true,
  },
  {
    key: FeatureKey.DOCUMENTS,
    envVar: 'FEATURE_DOCUMENTS',
    name: 'Documents',
    summary: 'Registration, insurance and licences kept as links with expiry dates.',
    step: 2,
    stepName: 'Put the paperwork somewhere',
    requires: [FeatureKey.FLEET],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.ASSIGNMENTS,
    envVar: 'FEATURE_ASSIGNMENTS',
    name: 'Handovers and returns',
    summary: 'Give a vehicle to a rider, take it back, and keep the record.',
    step: 3,
    stepName: 'Run the daily loop',
    requires: [FeatureKey.FLEET, FeatureKey.RIDERS],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.INSPECTIONS,
    envVar: 'FEATURE_INSPECTIONS',
    name: 'Condition checks',
    summary: 'The handover and return checklists, and the comparison between them.',
    step: 3,
    stepName: 'Run the daily loop',
    requires: [FeatureKey.ASSIGNMENTS],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.INCIDENTS,
    envVar: 'FEATURE_INCIDENTS',
    name: 'Accidents and damage',
    summary: 'Report incidents with evidence, decide responsibility, track repairs.',
    step: 4,
    stepName: 'Handle what goes wrong',
    requires: [FeatureKey.ASSIGNMENTS],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.MAINTENANCE,
    envVar: 'FEATURE_MAINTENANCE',
    name: 'Servicing and oil',
    summary: 'Service records and oil changes tracked by distance.',
    step: 5,
    stepName: 'Keep them running',
    requires: [FeatureKey.FLEET],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.FUEL_CARDS,
    envVar: 'FEATURE_FUEL_CARDS',
    name: 'Fuel cards',
    summary: 'Card inventory, limits, and who is holding which card.',
    step: 6,
    stepName: 'Control fuel',
    requires: [FeatureKey.FLEET],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.FUEL_TRANSACTIONS,
    envVar: 'FEATURE_FUEL_TRANSACTIONS',
    name: 'Fuel purchases',
    summary: 'Log each fill and flag anything over a card limit.',
    step: 6,
    stepName: 'Control fuel',
    requires: [FeatureKey.FUEL_CARDS],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.RENTALS,
    envVar: 'FEATURE_RENTALS',
    name: 'Rental charges',
    summary: 'Rates per vehicle and the charge worked out at return.',
    step: 7,
    stepName: 'Charge for it',
    requires: [FeatureKey.ASSIGNMENTS],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.PAYMENTS,
    envVar: 'FEATURE_PAYMENTS',
    name: 'Payments',
    summary: 'Record what has been collected against each rental.',
    step: 7,
    stepName: 'Charge for it',
    requires: [FeatureKey.RENTALS],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.ALERTS,
    envVar: 'FEATURE_ALERTS',
    name: 'Alerts',
    summary: 'Daily sweep for oil due, expiring papers, overdue vehicles and fuel limits.',
    step: 8,
    stepName: 'Let it watch for you',
    requires: [FeatureKey.FLEET],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.REPORTS,
    envVar: 'FEATURE_REPORTS',
    name: 'Reports and exports',
    summary: 'Fourteen filtered reports, downloadable as Excel or PDF.',
    step: 9,
    stepName: 'Answer to management',
    requires: [FeatureKey.FLEET],
    defaultEnabled: true,
  },
  {
    key: FeatureKey.AUDIT,
    envVar: 'FEATURE_AUDIT',
    name: 'Audit log',
    summary: 'Who changed what, and what it looked like before.',
    step: 9,
    stepName: 'Answer to management',
    requires: [],
    defaultEnabled: true,
  },
];

export const FEATURE_INDEX = new Map(FEATURES.map((feature) => [feature.key, feature]));

export type FeatureMap = Record<FeatureKey, boolean>;

export function defaultFeatureMap(): FeatureMap {
  return Object.fromEntries(FEATURES.map((feature) => [feature.key, feature.defaultEnabled])) as FeatureMap;
}

export type EnvSource = Record<string, string | undefined>;

function readBoolean(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const normalised = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(normalised)) return true;
  if (['0', 'false', 'off', 'no', 'disabled'].includes(normalised)) return false;
  return null;
}

/**
 * Works out what is switched on from the environment.
 *
 * `FEATURES` sets the baseline: `all` (the default) or a comma-separated list
 * of the features to show. A `FEATURE_*` variable then overrides one feature
 * either way, which is the quick lever when demonstrating a single screen.
 *
 *   FEATURES=fleet,riders,assignments,inspections
 *   FEATURE_REPORTS=true
 */
export function resolveFeaturesFromEnv(env: EnvSource = {}): FeatureMap {
  const map = defaultFeatureMap();

  const list = env.FEATURES?.trim();
  if (list && list.toLowerCase() !== 'all') {
    const wanted = new Set(
      list
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    );
    for (const feature of FEATURES) {
      map[feature.key] = wanted.has(feature.key.toLowerCase());
    }
  }

  for (const feature of FEATURES) {
    const override = readBoolean(env[feature.envVar]);
    if (override !== null) map[feature.key] = override;
    // Every screen assumes the fleet and the riders exist.
    if (feature.locked) map[feature.key] = true;
  }

  // A feature is no use without what it depends on, so it comes along quietly.
  let settled = false;
  while (!settled) {
    settled = true;
    for (const feature of FEATURES) {
      if (!map[feature.key]) continue;
      for (const requirement of feature.requires) {
        if (!map[requirement]) {
          map[feature.key] = false;
          settled = false;
        }
      }
    }
  }

  return map;
}

/** The rollout steps in order, each with the features that belong to it. */
export function featureSteps(): { step: number; name: string; features: FeatureDefinition[] }[] {
  const steps = new Map<number, { step: number; name: string; features: FeatureDefinition[] }>();
  for (const feature of FEATURES) {
    const entry = steps.get(feature.step) ?? { step: feature.step, name: feature.stepName, features: [] };
    entry.features.push(feature);
    steps.set(feature.step, entry);
  }
  return [...steps.values()].sort((a, b) => a.step - b.step);
}
