import { Injectable } from '@nestjs/common';
import { UpdateSettingsInput } from '@easytrip/shared';
import { InjectPrisma, AuditedPrismaClient, PrismaService } from '../../prisma/prisma.service';

export const SETTINGS_ID = 'settings';

/**
 * One row, always present. Currency and the identification label live here so
 * no screen hardcodes a country's conventions.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
  ) {}

  async get() {
    const existing = await this.raw.settings.findUnique({ where: { id: SETTINGS_ID } });
    if (existing) return existing;
    return this.raw.settings.create({ data: { id: SETTINGS_ID } });
  }

  async update(input: UpdateSettingsInput) {
    await this.get();
    return this.prisma.settings.update({ where: { id: SETTINGS_ID }, data: input });
  }
}
