import { Injectable } from '@nestjs/common';
import { Role } from '@easytrip/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface SearchHit {
  type: 'vehicle' | 'rider' | 'fuelCard' | 'assignment' | 'accident';
  id: string;
  label: string;
  detail: string;
  href: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One box across the whole product (FR-22). A rider searching only ever gets
 * their own records back.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(term: string, user: AuthenticatedUser): Promise<SearchHit[]> {
    const q = term.trim();
    if (q.length < 2) return [];

    const isRider = user.role === Role.RIDER;
    const riderId = user.riderId ?? '';
    const contains = { contains: q, mode: 'insensitive' as const };

    const [vehicles, riders, cards, assignments, accidents] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: UUID.test(q) ? { id: q } : { OR: [{ registration: contains }, { model: contains }] },
        take: 6,
        select: { id: true, registration: true, make: true, model: true, status: true },
      }),
      this.prisma.rider.findMany({
        where: {
          ...(isRider ? { id: riderId } : {}),
          ...(UUID.test(q) ? { id: q } : { OR: [{ fullName: contains }, { nationalId: contains }] }),
        },
        take: 6,
        select: { id: true, fullName: true, nationalId: true, status: true },
      }),
      isRider
        ? []
        : this.prisma.fuelCard.findMany({
            where: { cardNumber: contains },
            take: 6,
            select: { id: true, cardNumber: true, provider: true, status: true },
          }),
      this.prisma.vehicleAssignment.findMany({
        where: { ...(isRider ? { riderId } : {}), ...(UUID.test(q) ? { id: q } : { id: undefined }) },
        take: UUID.test(q) ? 4 : 0,
        select: {
          id: true,
          status: true,
          vehicle: { select: { registration: true } },
          rider: { select: { fullName: true } },
        },
      }),
      this.prisma.accident.findMany({
        where: {
          ...(isRider ? { riderId } : {}),
          ...(UUID.test(q) ? { id: q } : { reference: contains }),
        },
        take: 6,
        select: { id: true, reference: true, status: true, vehicle: { select: { registration: true } } },
      }),
    ]);

    return [
      ...vehicles.map<SearchHit>((v) => ({
        type: 'vehicle',
        id: v.id,
        label: v.registration,
        detail: `${v.make} ${v.model}`,
        href: `/fleet/${v.id}`,
      })),
      ...riders.map<SearchHit>((r) => ({
        type: 'rider',
        id: r.id,
        label: r.fullName,
        detail: r.nationalId,
        href: `/riders/${r.id}`,
      })),
      ...cards.map<SearchHit>((c) => ({
        type: 'fuelCard',
        id: c.id,
        label: c.cardNumber,
        detail: `${c.provider} · ${c.status.toLowerCase()}`,
        href: `/fuel/cards/${c.id}`,
      })),
      ...assignments.map<SearchHit>((a) => ({
        type: 'assignment',
        id: a.id,
        label: `${a.vehicle.registration} to ${a.rider.fullName}`,
        detail: a.status.toLowerCase(),
        href: `/operations/assignments/${a.id}`,
      })),
      ...accidents.map<SearchHit>((a) => ({
        type: 'accident',
        id: a.id,
        label: a.reference,
        detail: `${a.vehicle.registration} · ${a.status.toLowerCase().replace(/_/g, ' ')}`,
        href: `/incidents/accidents/${a.id}`,
      })),
    ];
  }
}
