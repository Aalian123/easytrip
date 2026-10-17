import { ForbiddenException } from '@nestjs/common';
import { Role } from '@easytrip/shared';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Riders see their own records and nothing else. Every list query a rider makes
 * is narrowed here rather than in the UI, and every record they fetch by id is
 * checked against their own rider profile.
 */
export function riderScopeFilter(user: AuthenticatedUser): { riderId: string } | Record<string, never> {
  if (user.role !== Role.RIDER) return {};
  if (!user.riderId) throw new ForbiddenException('This account is not linked to a rider profile');
  return { riderId: user.riderId };
}

export function assertRiderCanSee(user: AuthenticatedUser, riderId: string | null | undefined): void {
  if (user.role !== Role.RIDER) return;
  if (!user.riderId || riderId !== user.riderId) {
    throw new ForbiddenException('You can only view your own records');
  }
}
