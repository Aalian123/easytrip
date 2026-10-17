import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateMaintenanceInput,
  FeatureKey,
  Role,
  createMaintenanceSchema,
  paginationSchema,
} from '@easytrip/shared';
import { MaintenanceService } from './maintenance.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('maintenance')
@AuditModule('Maintenance')
@RequiresFeature(FeatureKey.MAINTENANCE)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    const page = paginationSchema.parse(query);
    return this.maintenance.list({ ...page, vehicleId: query.vehicleId, type: query.type });
  }

  @Get('oil-due')
  oilDue() {
    return this.maintenance.oilDue();
  }

  @Get('upcoming')
  upcoming(@Query('withinDays') withinDays?: string) {
    return this.maintenance.upcoming(Number(withinDays ?? 30));
  }

  @Post()
  @Roles(Role.FLEET_MANAGER)
  record(@Body(new ZodValidationPipe(createMaintenanceSchema)) body: CreateMaintenanceInput) {
    return this.maintenance.record(body);
  }
}
