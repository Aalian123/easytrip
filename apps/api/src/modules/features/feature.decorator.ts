import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '@easytrip/shared';

export const FEATURE_KEY = 'easytrip:feature';

/** Marks a route as belonging to a feature that can be switched off. */
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(FEATURE_KEY, feature);
