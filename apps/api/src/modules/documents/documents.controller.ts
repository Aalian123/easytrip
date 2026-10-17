import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocumentOwnerType } from '@prisma/client';
import {
  CreateDocumentInput,
  FeatureKey,
  Role,
  createDocumentSchema,
} from '@easytrip/shared';
import { DocumentsService } from './documents.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('documents')
@AuditModule('Documents')
@RequiresFeature(FeatureKey.DOCUMENTS)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query('ownerType') ownerType: DocumentOwnerType, @Query('ownerId') ownerId: string) {
    return this.documents.list(ownerType, ownerId);
  }

  @Get('expiring')
  expiring(@Query('withinDays') withinDays?: string) {
    return this.documents.expiring(Number(withinDays ?? 30));
  }

  @Post()
  @Roles(Role.FLEET_MANAGER)
  create(@Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentInput) {
    return this.documents.create(body);
  }
}
