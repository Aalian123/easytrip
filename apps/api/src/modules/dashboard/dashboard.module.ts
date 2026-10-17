import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MaintenanceModule } from '../maintenance/maintenance.module';

@Module({
  imports: [MaintenanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
