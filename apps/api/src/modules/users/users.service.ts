import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserInput, Role, UpdateUserInput } from '@easytrip/shared';
import { InjectPrisma, AuditedPrismaClient } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  riderId: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly auth: AuthService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: { ...PUBLIC_FIELDS, rider: { select: { id: true, fullName: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
    if (!user) throw new NotFoundException('That user no longer exists.');
    return user;
  }

  async create(input: CreateUserInput) {
    this.assertRiderLink(input.role, input.riderId ?? null);
    const passwordHash = await this.auth.hashPassword(input.password);
    return this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        riderId: input.riderId ?? null,
        passwordHash,
      },
      select: PUBLIC_FIELDS,
    });
  }

  async update(id: string, input: UpdateUserInput) {
    const existing = await this.get(id);
    const role = (input.role ?? existing.role) as Role;
    const riderId = input.riderId !== undefined ? input.riderId : existing.riderId;
    this.assertRiderLink(role, riderId ?? null);

    return this.prisma.user.update({
      where: { id },
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        riderId: input.riderId,
      },
      select: PUBLIC_FIELDS,
    });
  }

  async setPassword(id: string, newPassword: string) {
    const passwordHash = await this.auth.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { updated: true };
  }

  /** A rider login is only meaningful when it points at a rider profile. */
  private assertRiderLink(role: Role, riderId: string | null): void {
    if (role === Role.RIDER && !riderId) {
      throw new BadRequestException('Choose the rider profile this login belongs to.');
    }
    if (role !== Role.RIDER && riderId) {
      throw new BadRequestException('Only a rider login can be linked to a rider profile.');
    }
  }
}
