import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  FeatureKey,
  Role,
} from '@easytrip/shared';
import {
  CreateAssignmentInput,
  CreateInspectionInput,
  ReturnVehicleInput,
  assignmentQuerySchema,
  createAssignmentSchema,
  createInspectionSchema,
  returnVehicleSchema,
} from '@easytrip/shared';
import { AssignmentsService } from './assignments.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('assignments')
@AuditModule('Operations')
@RequiresFeature(FeatureKey.ASSIGNMENTS)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(assignmentQuerySchema)) query: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scoped = user.role === Role.RIDER ? { ...query, riderId: user.riderId ?? '' } : query;
    return this.assignments.list(scoped);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const assignment = await this.assignments.get(id);
    if (user.role === Role.RIDER) this.assignments.assertVisibleToRider(assignment.riderId, user.riderId);
    return assignment;
  }

  /** The handover-versus-return view (FR-06). */
  @Get(':id/comparison')
  @RequiresFeature(FeatureKey.INSPECTIONS)
  async comparison(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const assignment = await this.assignments.get(id);
    if (user.role === Role.RIDER) this.assignments.assertVisibleToRider(assignment.riderId, user.riderId);
    return this.assignments.comparison(id);
  }

  @Post()
  @Roles(Role.FLEET_MANAGER)
  assign(@Body(new ZodValidationPipe(createAssignmentSchema)) body: CreateAssignmentInput) {
    return this.assignments.assign(body);
  }

  @Post(':id/inspections')
  @RequiresFeature(FeatureKey.INSPECTIONS)
  @Roles(Role.FLEET_MANAGER)
  inspect(@Param('id') id: string, @Body(new ZodValidationPipe(createInspectionSchema)) body: CreateInspectionInput) {
    return this.assignments.addInspection(id, body);
  }

  @Post(':id/return')
  @Roles(Role.FLEET_MANAGER)
  return_(@Param('id') id: string, @Body(new ZodValidationPipe(returnVehicleSchema)) body: ReturnVehicleInput) {
    return this.assignments.returnVehicle(id, body);
  }
}
