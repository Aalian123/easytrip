import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role, UpdateSettingsInput, updateSettingsSchema } from '@easytrip/shared';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('settings')
@AuditModule('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Every signed-in user reads settings — the UI needs the currency symbol. */
  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  @Roles(Role.ADMIN)
  update(@Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput) {
    return this.settings.update(body);
  }
}
