import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { LoginInput, Role } from '@easytrip/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    riderId: string | null;
  };
}

const REFRESH_BYTES = 48;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same message either way — a wrong email should not be distinguishable
    // from a wrong password.
    if (!user || !user.isActive) throw new UnauthorizedException('Email or password is incorrect');

    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!valid) throw new UnauthorizedException('Email or password is incorrect');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      riderId: user.riderId,
    });
  }

  /** Rotates the refresh token: the presented one is revoked as it is spent. */
  async refresh(presentedToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({
      id: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      role: stored.user.role as Role,
      riderId: stored.user.riderId,
    });
  }

  async logout(presentedToken?: string): Promise<void> {
    if (!presentedToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, riderId: true, lastLoginAt: true },
    });
    if (!user) throw new UnauthorizedException('Sign in to continue');
    return user;
  }

  private async issueTokens(user: AuthResult['user']): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, name: user.name, role: user.role, riderId: user.riderId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // @nestjs/jwt types expiresIn as a literal duration union; ours comes
        // from configuration, so it is passed through as-is.
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as never,
      },
    );

    const refreshToken = randomBytes(REFRESH_BYTES).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs());

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt, user };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTtlMs(): number {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
    return value * unit;
  }
}
