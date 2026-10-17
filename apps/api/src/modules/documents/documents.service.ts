import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType } from '@prisma/client';
import { CreateDocumentInput, detectLinkProvider } from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService } from '../../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { currentContext } from '../../context/request-context';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
  ) {}

  list(ownerType: DocumentOwnerType, ownerId: string) {
    return this.raw.document.findMany({
      where: { ownerType, ownerId },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      include: { addedBy: { select: { id: true, name: true } } },
    });
  }

  /** Documents due to expire, soonest first — feeds the alerts job and reports. */
  expiring(withinDays: number) {
    const until = new Date(Date.now() + withinDays * 86_400_000);
    return this.raw.document.findMany({
      where: { expiresAt: { not: null, lte: until } },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async create(input: CreateDocumentInput) {
    await this.assertOwnerExists(input.ownerType, input.ownerId);

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: { ...input, addedById: currentContext().userId ?? null },
      });

      const summary = `${input.title} added${input.expiresAt ? `, expires ${new Date(input.expiresAt).toISOString().slice(0, 10)}` : ''}`;
      if (input.ownerType === 'VEHICLE') {
        await this.history.recordVehicleEvent(tx, {
          vehicleId: input.ownerId,
          type: 'DOCUMENT_ADDED',
          summary,
          payload: { docType: input.docType, provider: detectLinkProvider(input.url) },
        });
      } else {
        await this.history.recordRiderEvent(tx, {
          riderId: input.ownerId,
          type: 'DOCUMENT_ADDED',
          summary,
          payload: { docType: input.docType, provider: detectLinkProvider(input.url) },
        });
      }

      return document;
    });
  }

  private async assertOwnerExists(ownerType: DocumentOwnerType, ownerId: string): Promise<void> {
    const exists =
      ownerType === 'VEHICLE'
        ? await this.raw.vehicle.findUnique({ where: { id: ownerId }, select: { id: true } })
        : await this.raw.rider.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!exists) throw new NotFoundException('That record no longer exists.');
  }
}
