import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AssignFuelCardInput,
  CreateFuelCardInput,
  CreateFuelTransactionInput,
  FeatureKey,
  Role,
  assignFuelCardSchema,
  createFuelCardSchema,
  createFuelTransactionSchema,
  paginationSchema,
  updateFuelCardSchema,
} from '@easytrip/shared';
import { FuelCardStatus } from '@prisma/client';
import { FuelService } from './fuel.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('fuel')
@AuditModule('Fuel')
@RequiresFeature(FeatureKey.FUEL_CARDS)
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @Get('cards')
  @Roles(Role.FLEET_MANAGER, Role.ACCOUNTS, Role.VIEWER)
  listCards(@Query() query: Record<string, string>) {
    const page = paginationSchema.parse(query);
    return this.fuel.listCards({ ...page, status: query.status as FuelCardStatus, q: query.q });
  }

  @Get('cards/:id')
  @Roles(Role.FLEET_MANAGER, Role.ACCOUNTS, Role.VIEWER)
  getCard(@Param('id') id: string) {
    return this.fuel.getCard(id);
  }

  @Post('cards')
  @Roles(Role.FLEET_MANAGER)
  createCard(@Body(new ZodValidationPipe(createFuelCardSchema)) body: CreateFuelCardInput) {
    return this.fuel.createCard(body);
  }

  @Patch('cards/:id')
  @Roles(Role.FLEET_MANAGER)
  updateCard(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFuelCardSchema)) body: Partial<CreateFuelCardInput>,
  ) {
    return this.fuel.updateCard(id, body);
  }

  @Post('cards/:id/assign')
  @Roles(Role.FLEET_MANAGER)
  assign(@Param('id') id: string, @Body(new ZodValidationPipe(assignFuelCardSchema)) body: AssignFuelCardInput) {
    return this.fuel.assignCard(id, body);
  }

  @Post('cards/:id/release')
  @Roles(Role.FLEET_MANAGER)
  release(@Param('id') id: string) {
    return this.fuel.releaseCard(id);
  }

  @Get('transactions')
  @RequiresFeature(FeatureKey.FUEL_TRANSACTIONS)
  listTransactions(@Query() query: Record<string, string>, @CurrentUser() user: AuthenticatedUser) {
    const page = paginationSchema.parse(query);
    return this.fuel.listTransactions({
      ...page,
      fuelCardId: query.fuelCardId,
      vehicleId: query.vehicleId,
      riderId: user.role === Role.RIDER ? user.riderId ?? '' : query.riderId,
      flagged: query.flagged === 'true',
    });
  }

  /** Riders log their own refuelling with a receipt link. */
  @Post('transactions')
  @RequiresFeature(FeatureKey.FUEL_TRANSACTIONS)
  @Roles(Role.FLEET_MANAGER, Role.ACCOUNTS, Role.RIDER)
  recordTransaction(
    @Body(new ZodValidationPipe(createFuelTransactionSchema)) body: CreateFuelTransactionInput,
  ) {
    return this.fuel.recordTransaction(body);
  }
}
