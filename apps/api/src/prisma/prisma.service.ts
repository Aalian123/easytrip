import { INestApplication, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { withAudit } from './audit.extension';

export type AuditedPrismaClient = ReturnType<typeof withAudit>;

/**
 * The client handed to an interactive transaction callback. Extensions are
 * preserved inside a transaction, so this is the extended client minus the
 * connection-level methods.
 */
export type TxClient = Omit<
  AuditedPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const PRISMA = Symbol('PRISMA');

/**
 * The raw client is used for reads, transactions and anything that must not be
 * audited (seeding, the alert generator); the audited client wraps it and is
 * what application services inject.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export const prismaProviders = [
  PrismaService,
  {
    provide: PRISMA,
    inject: [PrismaService],
    useFactory: (prisma: PrismaService): AuditedPrismaClient => withAudit(prisma),
  },
];

export const InjectPrisma = () => Inject(PRISMA);

export async function enableShutdownHooks(app: INestApplication): Promise<void> {
  process.on('beforeExit', async () => {
    await app.close();
  });
}
