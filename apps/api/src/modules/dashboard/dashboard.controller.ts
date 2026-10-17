import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuditModule } from '../../common/decorators/audit-module.decorator';

@ApiTags('dashboard')
@AuditModule('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  summary() {
    return this.dashboard.summary();
  }
}
