import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateVehicleInput,
  RentalRateInput,
  Role,
  UpdateVehicleInput,
  VehicleQuery,
  changeVehicleStatusSchema,
  createVehicleSchema,
  rentalRateSchema,
  updateVehicleSchema,
  vehicleQuerySchema,
} from '@easytrip/shared';
import { VehicleStatus } from '@prisma/client';
import { VehiclesService } from './vehicles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('vehicles')
@AuditModule('Fleet')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(vehicleQuerySchema)) query: VehicleQuery) {
    return this.vehicles.list(query);
  }

  @Get('availability')
  availability() {
    return this.vehicles.availability();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.vehicles.get(id);
  }

  @Get(':id/timeline')
  timeline(@Param('id') id: string) {
    return this.vehicles.timeline(id);
  }

  @Post()
  @Roles(Role.FLEET_MANAGER)
  create(@Body(new ZodValidationPipe(createVehicleSchema)) body: CreateVehicleInput) {
    return this.vehicles.create(body);
  }

  @Patch(':id')
  @Roles(Role.FLEET_MANAGER)
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateVehicleSchema)) body: UpdateVehicleInput) {
    return this.vehicles.update(id, body);
  }

  @Post(':id/status')
  @Roles(Role.FLEET_MANAGER)
  changeStatus(@Param('id') id: string, @Body(new ZodValidationPipe(changeVehicleStatusSchema)) body: { status: VehicleStatus; reason?: string | null }) {
    return this.vehicles.changeStatus(id, body.status, body.reason);
  }

  @Post(':id/rates')
  @Roles(Role.FLEET_MANAGER, Role.ACCOUNTS)
  setRate(@Param('id') id: string, @Body(new ZodValidationPipe(rentalRateSchema)) body: RentalRateInput) {
    return this.vehicles.setRate(id, body);
  }
}
