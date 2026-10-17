import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Role } from '@easytrip/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  riderId: string | null;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as AuthenticatedUser;
});
