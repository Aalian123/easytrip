import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RiderStatus } from '@prisma/client';
import {
  CreateRiderInput,
  Role,
  changeRiderStatusSchema,
  createRiderSchema,
  riderQuerySchema,
  updateRiderSchema,
} from '@easytrip/shared';
import { RidersService } from './riders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertRiderCanSee, riderScopeFilter } from '../../common/guards/rider-scope';

@ApiTags('riders')
@AuditModule('Riders')
@Controller('riders')
export class RidersController {
  constructor(private readonly riders: RidersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(riderQuerySchema)) query: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // A rider signing in sees a list of exactly one person: themselves.
    const scope = riderScopeFilter(user);
    return this.riders.list({ ...query, riderId: (scope as { riderId?: string }).riderId });
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    assertRiderCanSee(user, id);
    return this.riders.get(id);
  }

  @Get(':id/history')
  async history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    assertRiderCanSee(user, id);
    return this.riders.history_(id);
  }

  @Post()
  @Roles(Role.FLEET_MANAGER)
  create(@Body(new ZodValidationPipe(createRiderSchema)) body: CreateRiderInput) {
    return this.riders.create(body);
  }

  @Patch(':id')
  @Roles(Role.FLEET_MANAGER)
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateRiderSchema)) body: Partial<CreateRiderInput>) {
    return this.riders.update(id, body);
  }

  @Post(':id/status')
  @Roles(Role.FLEET_MANAGER)
  changeStatus(@Param('id') id: string, @Body(new ZodValidationPipe(changeRiderStatusSchema)) body: { status: RiderStatus; reason?: string | null }) {
    return this.riders.changeStatus(id, body.status, body.reason);
  }
}
