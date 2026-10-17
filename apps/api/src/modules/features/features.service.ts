import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FEATURES, FeatureKey, FeatureMap, featureSteps, resolveFeaturesFromEnv } from '@easytrip/shared';

/**
 * Which parts of the platform are switched on.
 *
 * This is decided by the environment and nothing else — set it in .env, restart,
 * and the API and the menu agree. There is deliberately no way to change it from
 * inside the running app: the point is to show a client exactly the slice of the
 * product that is ready, and have that be the same on every screen.
 */
@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);
  private readonly features: FeatureMap;

  constructor(private readonly config: ConfigService) {
    // ConfigService first so a repo-root .env is picked up, then the process.
    const env = Object.fromEntries(
      [...FEATURES.map((feature) => feature.envVar), 'FEATURES'].map((key) => [
        key,
        this.config.get<string>(key) ?? process.env[key],
      ]),
    );

    this.features = resolveFeaturesFromEnv(env);

    const off = FEATURES.filter((feature) => !this.features[feature.key]).map((feature) => feature.key);
    this.logger.log(off.length ? `Features switched off: ${off.join(', ')}` : 'All features switched on');
  }

  map(): FeatureMap {
    return this.features;
  }

  isEnabled(key: FeatureKey): boolean {
    return this.features[key] ?? false;
  }

  /** The catalogue, the switches, and the variable that sets each one. */
  catalogue() {
    return {
      features: FEATURES.map((feature) => ({ ...feature, enabled: this.features[feature.key] })),
      steps: featureSteps().map((step) => ({
        step: step.step,
        name: step.name,
        features: step.features.map((feature) => feature.key),
        enabled: step.features.every((feature) => this.features[feature.key]),
      })),
      enabled: this.features,
      source: 'environment' as const,
    };
  }
}
