import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import {
  FeatureKey,
  Role,
  paginationSchema,
  recordPaymentSchema,
} from '@easytrip/shared';
import { RentalsService } from './rentals.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('rentals')
@AuditModule('Finance')
@RequiresFeature(FeatureKey.RENTALS)
@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get()
  @Roles(Role.ACCOUNTS, Role.FLEET_MANAGER, Role.VIEWER)
  list(@Query() query: Record<string, string>, @CurrentUser() user: AuthenticatedUser) {
    const page = paginationSchema.parse(query);
    return this.rentals.list({
      ...page,
      paymentStatus: query.paymentStatus as PaymentStatus,
      vehicleId: query.vehicleId,
      riderId: user.role === Role.RIDER ? user.riderId ?? '' : query.riderId,
    });
  }

  @Get(':id')
  @Roles(Role.ACCOUNTS, Role.FLEET_MANAGER, Role.VIEWER)
  get(@Param('id') id: string) {
    return this.rentals.get(id);
  }

  /** Live quote for a rental still in progress. */
  @Get('quote/:assignmentId')
  @Roles(Role.ACCOUNTS, Role.FLEET_MANAGER)
  quote(@Param('assignmentId') assignmentId: string, @Query() query: Record<string, string>) {
    const numeric = Object.fromEntries(
      ['fuelCharge', 'damageCharge', 'trafficFines', 'otherCharges', 'discount']
        .filter((key) => query[key] != null)
        .map((key) => [key, Number(query[key])]),
    );
    return this.rentals.quote(assignmentId, query.endAt ? new Date(query.endAt) : new Date(), numeric);
  }

  @Post(':id/payments')
  @RequiresFeature(FeatureKey.PAYMENTS)
  @Roles(Role.ACCOUNTS)
  recordPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: { amount: number; paymentStatus?: PaymentStatus },
  ) {
    return this.rentals.recordPayment(id, body.amount, body.paymentStatus);
  }
}
