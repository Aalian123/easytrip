import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateAccidentInput,
  CreateDamageInput,
  FeatureKey,
  Role,
  UpdateAccidentInput,
  createAccidentSchema,
  createDamageSchema,
  paginationSchema,
  updateAccidentSchema,
  updateDamageSchema,
} from '@easytrip/shared';
import { IncidentsService } from './incidents.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertRiderCanSee } from '../../common/guards/rider-scope';

@ApiTags('incidents')
@AuditModule('Incidents')
@RequiresFeature(FeatureKey.INCIDENTS)
@Controller()
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get('accidents')
  listAccidents(@Query() query: Record<string, string>, @CurrentUser() user: AuthenticatedUser) {
    const page = paginationSchema.parse(query);
    return this.incidents.listAccidents({
      ...page,
      status: query.status as never,
      vehicleId: query.vehicleId,
      riderId: user.role === Role.RIDER ? user.riderId ?? '' : query.riderId,
    });
  }

  @Get('accidents/:id')
  async getAccident(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const accident = await this.incidents.getAccident(id);
    if (user.role === Role.RIDER) assertRiderCanSee(user, accident.riderId);
    return accident;
  }

  /** Riders report their own accidents; managers report any. */
  @Post('accidents')
  @Roles(Role.FLEET_MANAGER, Role.RIDER)
  reportAccident(@Body(new ZodValidationPipe(createAccidentSchema)) body: CreateAccidentInput) {
    return this.incidents.reportAccident(body);
  }

  @Patch('accidents/:id')
  @Roles(Role.FLEET_MANAGER)
  updateAccident(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAccidentSchema)) body: UpdateAccidentInput,
  ) {
    return this.incidents.updateAccident(id, body);
  }

  @Get('damages')
  listDamages(@Query() query: Record<string, string>, @CurrentUser() user: AuthenticatedUser) {
    const page = paginationSchema.parse(query);
    return this.incidents.listDamages({
      ...page,
      vehicleId: query.vehicleId,
      riderId: user.role === Role.RIDER ? user.riderId ?? '' : query.riderId,
      repairStatus: query.repairStatus,
    });
  }

  @Post('damages')
  @Roles(Role.FLEET_MANAGER, Role.RIDER)
  recordDamage(@Body(new ZodValidationPipe(createDamageSchema)) body: CreateDamageInput) {
    return this.incidents.recordDamage(body);
  }

  @Patch('damages/:id')
  @Roles(Role.FLEET_MANAGER)
  updateDamage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDamageSchema)) body: Record<string, unknown>,
  ) {
    return this.incidents.updateDamage(id, body);
  }
}
