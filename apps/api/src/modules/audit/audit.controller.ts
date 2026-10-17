import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { FeatureKey, Role, paginationSchema } from '@easytrip/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../features/feature.decorator';

/**
 * FR-24. Read-only for everyone, including administrators — the table itself
 * rejects updates and deletes.
 */
@ApiTags('audit')
@AuditModule('Audit')
@Roles(Role.ADMIN, Role.ACCOUNTS, Role.VIEWER)
@RequiresFeature(FeatureKey.AUDIT)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const page = paginationSchema.parse(query);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.module ? { module: query.module } : {}),
      ...(query.recordType ? { recordType: query.recordType } : {}),
      ...(query.recordId ? { recordId: query.recordId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return { total, page: page.page, pageSize: page.pageSize, rows };
  }

  @Get('modules')
  async modules() {
    const rows = await this.prisma.auditLog.groupBy({ by: ['module'], _count: { _all: true } });
    return rows.map((row) => ({ module: row.module, count: row._count._all }));
  }
}
