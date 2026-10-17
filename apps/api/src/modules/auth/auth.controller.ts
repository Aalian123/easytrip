import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginInput, loginSchema } from '@easytrip/shared';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

const REFRESH_COOKIE = 'easytrip_refresh';

@ApiTags('auth')
@AuditModule('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginInput, @Res({ passthrough: true }) res: any) {
    const result = await this.auth.login(body);
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Sign in to continue');
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { signedOut: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  private setRefreshCookie(res: any, token: string, expiresAt: Date): void {
    res.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expiresAt,
    });
  }
}
