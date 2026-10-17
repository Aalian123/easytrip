import { SetMetadata } from '@nestjs/common';
import { Role } from '@easytrip/shared';

export const ROLES_KEY = 'easytrip:roles';

/** Restricts a route to the listed roles. Admins always pass. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
