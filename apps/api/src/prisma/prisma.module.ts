import { Global, Module } from '@nestjs/common';
import { PRISMA, PrismaService, prismaProviders } from './prisma.service';

@Global()
@Module({
  providers: prismaProviders,
  exports: [PRISMA, PrismaService],
})
export class PrismaModule {}
