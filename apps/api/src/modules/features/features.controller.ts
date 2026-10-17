import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FeaturesService } from './features.service';
import { AuditModule } from '../../common/decorators/audit-module.decorator';

@ApiTags('features')
@AuditModule('Settings')
@Controller('features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  /** Read-only: the menu is built from this, and the environment decides it. */
  @Get()
  catalogue() {
    return this.features.catalogue();
  }
}
