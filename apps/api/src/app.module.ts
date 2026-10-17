import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthModule } from './modules/health/health.module';
import { HistoryModule } from './modules/history/history.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { RidersModule } from './modules/riders/riders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MediaModule } from './modules/media/media.module';
import { SearchModule } from './modules/search/search.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { FuelModule } from './modules/fuel/fuel.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditViewerModule } from './modules/audit/audit.module';
import { FeaturesModule } from './modules/features/features.module';
import { DeletionsModule } from './modules/deletions/deletions.module';
import { FeatureGuard } from './modules/features/feature.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Generous for ordinary use, tight enough that guessing a password by hand
    // or by script is not worth trying.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ConfigModule.forRoot({
      isGlobal: true,
      // Repo-root .env first so one file configures the whole workspace.
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    HealthModule,
    HistoryModule,
    VehiclesModule,
    RidersModule,
    DocumentsModule,
    MediaModule,
    SearchModule,
    AssignmentsModule,
    IncidentsModule,
    MaintenanceModule,
    FuelModule,
    RentalsModule,
    DashboardModule,
    NotificationsModule,
    ReportsModule,
    AuditViewerModule,
    FeaturesModule,
    DeletionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
