import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { calculateRentalCharge } from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RentalsService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
  ) {}

  async list(query: { page: number; pageSize: number; paymentStatus?: PaymentStatus; vehicleId?: string; riderId?: string }) {
    const where: Prisma.RentalChargeWhereInput = {
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.riderId ? { assignment: { riderId: query.riderId } } : {}),
    };

    const [total, rows, totals] = await Promise.all([
      this.raw.rentalCharge.count({ where }),
      this.raw.rentalCharge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          vehicle: { select: { id: true, registration: true, make: true, model: true } },
          assignment: {
            select: {
              id: true,
              assignedAt: true,
              returnedAt: true,
              rider: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      this.raw.rentalCharge.aggregate({ where, _sum: { totalAmount: true, paidAmount: true } }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      rows,
      billed: Number(totals._sum.totalAmount ?? 0),
      collected: Number(totals._sum.paidAmount ?? 0),
    };
  }

  async get(id: string) {
    const charge = await this.raw.rentalCharge.findUnique({
      where: { id },
      include: {
        vehicle: true,
        assignment: { include: { rider: true, inspections: true, damages: true } },
      },
    });
    if (!charge) throw new NotFoundException('That rental charge no longer exists.');
    return charge;
  }

  /**
   * What a rental would cost if it ended now — used by the return screen so the
   * operator sees the figure before committing.
   */
  async quote(assignmentId: string, endAt = new Date(), extras: Record<string, number> = {}) {
    const assignment = await this.raw.vehicleAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('That assignment no longer exists.');

    const snapshot = (assignment.rateSnapshot ?? {}) as Record<string, number | null>;
    return calculateRentalCharge({
      startAt: assignment.assignedAt,
      endAt,
      expectedReturnAt: assignment.expectedReturnAt,
      rates: {
        dailyRate: Number(snapshot.dailyRate ?? 0),
        weeklyRate: snapshot.weeklyRate ?? null,
        monthlyRate: snapshot.monthlyRate ?? null,
        lateReturnFeePerDay: snapshot.lateReturnFeePerDay ?? null,
      },
      extras: {
        fuelCharge: extras.fuelCharge ?? 0,
        damageCharge: extras.damageCharge ?? 0,
        trafficFines: extras.trafficFines ?? 0,
        otherCharges: extras.otherCharges ?? 0,
        discount: extras.discount ?? 0,
      },
    });
  }

  /** Accounts record what has been collected; the charge itself is not rewritten. */
  async recordPayment(id: string, amount: number, paymentStatus?: PaymentStatus) {
    const charge = await this.get(id);
    const paid = Number(charge.paidAmount) + amount;
    const total = Number(charge.totalAmount);

    return this.prisma.rentalCharge.update({
      where: { id },
      data: {
        paidAmount: new Prisma.Decimal(paid),
        paymentStatus:
          paymentStatus ?? (paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID'),
      },
    });
  }
}
