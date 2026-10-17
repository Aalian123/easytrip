import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role as PrismaRole } from '@prisma/client';
import {
  FeatureKey,
  Role,
} from '@easytrip/shared';
import { NotificationsService } from './notifications.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { RequiresFeature } from '../../modules/features/feature.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@AuditModule('Notifications')
@RequiresFeature(FeatureKey.ALERTS)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('unreadOnly') unreadOnly?: string) {
    return this.notifications.list({
      role: user.role as PrismaRole,
      userId: user.id,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.role as PrismaRole, user.id);
  }

  /** Runs the sweep on demand; it also runs itself every morning. */
  @Post('generate')
  @Roles(Role.ADMIN, Role.FLEET_MANAGER)
  async generate() {
    const created = await this.notifications.generate();
    return { created };
  }
}
