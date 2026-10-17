import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@easytrip/shared';
import { DeletionsService } from './deletions.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';

/**
 * Administrators only. GET says what a deletion would take with it; DELETE
 * carries it out and records it in the audit log.
 */
@ApiTags('deletions')
@AuditModule('Deletions')
@Roles(Role.ADMIN)
@Controller('deletions')
export class DeletionsController {
  constructor(private readonly deletions: DeletionsService) {}

  @Get(':kind/:id')
  preview(@Param('kind') kind: string, @Param('id') id: string) {
    return this.deletions.preview(kind, id);
  }

  @Delete(':kind/:id')
  remove(@Param('kind') kind: string, @Param('id') id: string) {
    return this.deletions.remove(kind, id);
  }
}
