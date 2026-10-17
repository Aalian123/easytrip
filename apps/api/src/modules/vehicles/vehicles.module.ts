import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleStatusService } from './vehicle-status.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleStatusService],
  exports: [VehiclesService, VehicleStatusService],
})
export class VehiclesModule {}
