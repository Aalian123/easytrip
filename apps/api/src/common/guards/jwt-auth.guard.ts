import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUDIT_MODULE_KEY } from '../decorators/audit-module.decorator';
import { currentContext } from '../../context/request-context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const auditModule = this.reflector.getAllAndOverride<string>(AUDIT_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      Object.assign(currentContext(), { module: auditModule });
      return true;
    }

    const header: string | undefined = request.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Sign in to continue');

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      request.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        riderId: payload.riderId ?? null,
      };
    } catch {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    // The store object was put in place by the onRequest hook in main.ts;
    // filling it in here attributes every later write to this user.
    Object.assign(currentContext(), {
      userId: request.user.id,
      userLabel: `${request.user.name} <${request.user.email}>`,
      role: request.user.role,
      riderId: request.user.riderId,
      module: auditModule,
    });

    return true;
  }
}
