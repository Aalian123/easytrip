import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_INDEX, FeatureKey } from '@easytrip/shared';
import { FEATURE_KEY } from './feature.decorator';
import { FeaturesService } from './features.service';

/**
 * Keeps a switched-off feature switched off at the API, not only in the menu —
 * otherwise a bookmarked URL would walk straight past the decision.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeaturesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<FeatureKey>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    if (this.features.isEnabled(required)) return true;

    const feature = FEATURE_INDEX.get(required);
    throw new ForbiddenException(
      `${feature?.name ?? required} is not switched on. Set ${feature?.envVar ?? required}=true in .env and restart the API.`,
    );
  }
}
