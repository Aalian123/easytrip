import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateMediaLinkInput, detectLinkProvider } from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService } from '../../prisma/prisma.service';
import { currentContext } from '../../context/request-context';

/**
 * Photos and videos live in the operator's own drive; the platform records the
 * link, who added it and what it belongs to (FR-10).
 */
@Injectable()
export class MediaService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
  ) {}

  list(filter: Partial<Record<'vehicleId' | 'riderId' | 'assignmentId' | 'inspectionId' | 'accidentId' | 'damageId' | 'maintenanceId', string>>) {
    const where: Prisma.MediaLinkWhereInput = Object.fromEntries(
      Object.entries(filter).filter(([, value]) => Boolean(value)),
    );
    return this.raw.mediaLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  create(input: CreateMediaLinkInput) {
    return this.prisma.mediaLink.create({
      data: {
        ...input,
        provider: detectLinkProvider(input.url),
        uploadedById: currentContext().userId ?? null,
      },
    });
  }
}
