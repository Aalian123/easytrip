import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  FeatureKey,
  Role,
  reportQuerySchema,
} from '@easytrip/shared';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';

@ApiTags('reports')
@AuditModule('Reports')
@Roles(Role.FLEET_MANAGER, Role.ACCOUNTS, Role.VIEWER)
@RequiresFeature(FeatureKey.REPORTS)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  catalogue() {
    return this.reports.catalogue();
  }

  /** One route serves the table, the spreadsheet and the PDF (FR-23). */
  @Get(':key')
  async run(@Param('key') key: string, @Query() query: Record<string, string>, @Res({ passthrough: true }) res: any) {
    const parsed = reportQuerySchema.parse(query);
    const filters = {
      from: parsed.from ?? null,
      to: parsed.to ?? null,
      vehicleId: parsed.vehicleId,
      riderId: parsed.riderId,
      status: parsed.status,
    };

    if (parsed.format === 'xlsx') {
      const buffer = await this.reports.toExcel(key, filters);
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.header('Content-Disposition', `attachment; filename="${key}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.send(buffer);
    }

    if (parsed.format === 'pdf') {
      const buffer = await this.reports.toPdf(key, filters);
      res.header('Content-Type', 'application/pdf');
      res.header('Content-Disposition', `attachment; filename="${key}-${new Date().toISOString().slice(0, 10)}.pdf"`);
      return res.send(buffer);
    }

    return this.reports.run(key, filters);
  }
}
