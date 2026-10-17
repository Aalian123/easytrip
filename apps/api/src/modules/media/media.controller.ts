import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateMediaLinkInput, Role, createMediaLinkSchema } from '@easytrip/shared';
import { MediaService } from './media.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('media')
@AuditModule('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.media.list(query);
  }

  /** Riders may attach evidence to their own accidents and damage reports. */
  @Post()
  @Roles(Role.FLEET_MANAGER, Role.RIDER)
  create(@Body(new ZodValidationPipe(createMediaLinkSchema)) body: CreateMediaLinkInput) {
    return this.media.create(body);
  }
}
