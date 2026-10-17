import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FuelCardStatus, Prisma } from '@prisma/client';
import {
  AssignFuelCardInput,
  CreateFuelCardInput,
  CreateFuelTransactionInput,
  FUEL_CARD_UNASSIGNABLE,
  evaluateFuelLimits,
} from '@easytrip/shared';
import { AuditedPrismaClient, InjectPrisma, PrismaService } from '../../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { decimalOrNull } from '../../common/decimal';

@Injectable()
export class FuelService {
  constructor(
    @InjectPrisma() private readonly prisma: AuditedPrismaClient,
    private readonly raw: PrismaService,
    private readonly history: HistoryService,
  ) {}

  // ------------------------------------------------------------------ cards

  async listCards(query: { page: number; pageSize: number; status?: FuelCardStatus; q?: string }) {
    const where: Prisma.FuelCardWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { OR: [{ cardNumber: { contains: query.q } }, { provider: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.raw.fuelCard.count({ where }),
      this.raw.fuelCard.findMany({
        where,
        orderBy: { cardNumber: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          assignments: {
            where: { releasedAt: null },
            take: 1,
            include: {
              rider: { select: { id: true, fullName: true } },
              vehicle: { select: { id: true, registration: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      rows: rows.map(({ assignments, ...card }) => ({ ...card, currentHolder: assignments[0] ?? null })),
    };
  }

  async getCard(id: string) {
    const card = await this.raw.fuelCard.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            rider: { select: { id: true, fullName: true } },
            vehicle: { select: { id: true, registration: true } },
          },
        },
        transactions: { orderBy: { occurredAt: 'desc' }, take: 50 },
      },
    });
    if (!card) throw new NotFoundException('That fuel card no longer exists.');

    const usage = await this.usage(id);
    return { ...card, currentHolder: card.assignments.find((a) => !a.releasedAt) ?? null, usage };
  }

  createCard(input: CreateFuelCardInput) {
    return this.prisma.fuelCard.create({
      data: {
        ...input,
        dailyLimit: input.dailyLimit != null ? new Prisma.Decimal(input.dailyLimit) : null,
        weeklyLimit: input.weeklyLimit != null ? new Prisma.Decimal(input.weeklyLimit) : null,
        monthlyLimit: input.monthlyLimit != null ? new Prisma.Decimal(input.monthlyLimit) : null,
      },
    });
  }

  async updateCard(id: string, input: Partial<CreateFuelCardInput> & { status?: FuelCardStatus }) {
    const card = await this.getCard(id);

    // ASSIGNED is owned by issue and release, which also keep the holding
    // history. Editing the status directly would leave the two out of step.
    if (input.status && input.status !== card.status) {
      if (input.status === 'ASSIGNED') {
        throw new ConflictException('Issue the card to a rider or vehicle to mark it assigned.');
      }
      if (card.currentHolder) {
        throw new ConflictException(`Release fuel card ${card.cardNumber} before changing its status.`);
      }
    }

    return this.prisma.fuelCard.update({
      where: { id },
      data: {
        ...input,
        dailyLimit: decimalOrNull(input.dailyLimit),
        weeklyLimit: decimalOrNull(input.weeklyLimit),
        monthlyLimit: decimalOrNull(input.monthlyLimit),
      },
    });
  }

  /** FR-16 / BR-09 / BR-12. Holding history is kept; only the current row is open. */
  async assignCard(cardId: string, input: AssignFuelCardInput) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.fuelCard.findUnique({ where: { id: cardId } });
      if (!card) throw new NotFoundException('That fuel card no longer exists.');

      if (FUEL_CARD_UNASSIGNABLE.includes(card.status as never)) {
        throw new ConflictException(
          `Fuel card ${card.cardNumber} is ${card.status.toLowerCase()} and cannot be issued.`,
        );
      }
      if (card.expiryDate && card.expiryDate < new Date()) {
        throw new ConflictException(
          `Fuel card ${card.cardNumber} expired on ${card.expiryDate.toISOString().slice(0, 10)}.`,
        );
      }

      const open = await tx.fuelCardAssignment.findFirst({ where: { fuelCardId: cardId, releasedAt: null } });
      if (open) throw new ConflictException(`Fuel card ${card.cardNumber} is already held. Release it first.`);

      const assignment = await tx.fuelCardAssignment.create({
        data: {
          fuelCardId: cardId,
          riderId: input.riderId ?? null,
          vehicleId: input.vehicleId ?? null,
          assignedAt: input.assignedAt,
          notes: input.notes ?? null,
        },
      });

      await tx.fuelCard.update({ where: { id: cardId }, data: { status: 'ASSIGNED' } });

      if (input.vehicleId) {
        await this.history.recordVehicleEvent(tx, {
          vehicleId: input.vehicleId,
          type: 'FUEL_CARD_ASSIGNED',
          occurredAt: input.assignedAt,
          summary: `Fuel card ${card.cardNumber} issued`,
          payload: { fuelCardId: cardId },
        });
      }
      if (input.riderId) {
        await this.history.recordRiderEvent(tx, {
          riderId: input.riderId,
          type: 'FUEL_CARD_ASSIGNED',
          occurredAt: input.assignedAt,
          summary: `Holds fuel card ${card.cardNumber}`,
          payload: { fuelCardId: cardId },
        });
      }

      return assignment;
    });
  }

  async releaseCard(cardId: string) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.fuelCard.findUnique({ where: { id: cardId } });
      if (!card) throw new NotFoundException('That fuel card no longer exists.');

      const open = await tx.fuelCardAssignment.findFirst({ where: { fuelCardId: cardId, releasedAt: null } });
      if (!open) throw new ConflictException(`Fuel card ${card.cardNumber} is not currently held.`);

      const released = await tx.fuelCardAssignment.update({
        where: { id: open.id },
        data: { releasedAt: new Date() },
      });
      await tx.fuelCard.update({ where: { id: cardId }, data: { status: 'AVAILABLE' } });

      if (open.vehicleId) {
        await this.history.recordVehicleEvent(tx, {
          vehicleId: open.vehicleId,
          type: 'FUEL_CARD_RELEASED',
          summary: `Fuel card ${card.cardNumber} returned`,
          payload: { fuelCardId: cardId },
        });
      }
      if (open.riderId) {
        await this.history.recordRiderEvent(tx, {
          riderId: open.riderId,
          type: 'FUEL_CARD_RELEASED',
          summary: `Returned fuel card ${card.cardNumber}`,
          payload: { fuelCardId: cardId },
        });
      }

      return released;
    });
  }

  // ----------------------------------------------------------- transactions

  async listTransactions(query: {
    page: number;
    pageSize: number;
    fuelCardId?: string;
    vehicleId?: string;
    riderId?: string;
    flagged?: boolean;
  }) {
    const where: Prisma.FuelTransactionWhereInput = {
      ...(query.fuelCardId ? { fuelCardId: query.fuelCardId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.riderId ? { riderId: query.riderId } : {}),
      ...(query.flagged ? { flagged: true } : {}),
    };
    const [total, rows] = await Promise.all([
      this.raw.fuelTransaction.count({ where }),
      this.raw.fuelTransaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          fuelCard: { select: { id: true, cardNumber: true } },
          vehicle: { select: { id: true, registration: true } },
          rider: { select: { id: true, fullName: true } },
        },
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, rows };
  }

  /** FR-17 / BR-10. A purchase that breaks a limit is recorded and flagged, not refused. */
  async recordTransaction(input: CreateFuelTransactionInput) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.fuelCard.findUnique({ where: { id: input.fuelCardId } });
      if (!card) throw new NotFoundException('That fuel card no longer exists.');

      // Whoever held the card when the fuel was bought, not whoever holds it now,
      // so a receipt entered late is still charged to the right rider.
      const holder = await tx.fuelCardAssignment.findFirst({
        where: {
          fuelCardId: card.id,
          assignedAt: { lte: input.occurredAt },
          OR: [{ releasedAt: null }, { releasedAt: { gte: input.occurredAt } }],
        },
        orderBy: { assignedAt: 'desc' },
      });

      const history = await tx.fuelTransaction.findMany({
        where: {
          fuelCardId: card.id,
          occurredAt: { gte: new Date(input.occurredAt.getTime() - 31 * 86_400_000) },
        },
        select: { occurredAt: true, amount: true },
      });

      const evaluation = evaluateFuelLimits(
        { occurredAt: input.occurredAt, amount: input.amount },
        history.map((row) => ({ occurredAt: row.occurredAt, amount: Number(row.amount) })),
        {
          dailyLimit: card.dailyLimit ? Number(card.dailyLimit) : null,
          weeklyLimit: card.weeklyLimit ? Number(card.weeklyLimit) : null,
          monthlyLimit: card.monthlyLimit ? Number(card.monthlyLimit) : null,
        },
      );

      const transaction = await tx.fuelTransaction.create({
        data: {
          fuelCardId: card.id,
          vehicleId: input.vehicleId ?? holder?.vehicleId ?? null,
          riderId: input.riderId ?? holder?.riderId ?? null,
          occurredAt: input.occurredAt,
          station: input.station ?? null,
          litres: new Prisma.Decimal(input.litres),
          amount: new Prisma.Decimal(input.amount),
          vehicleMileage: input.vehicleMileage ?? null,
          receiptUrl: input.receiptUrl ?? null,
          notes: input.notes ?? null,
          flagged: evaluation.flagged,
          flagReason: evaluation.flagReason,
        },
      });

      const vehicleId = transaction.vehicleId;
      if (vehicleId) {
        if (input.vehicleMileage) {
          const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { currentMileage: true } });
          if (vehicle && input.vehicleMileage > vehicle.currentMileage) {
            await tx.vehicle.update({ where: { id: vehicleId }, data: { currentMileage: input.vehicleMileage } });
          }
        }
        await this.history.recordVehicleEvent(tx, {
          vehicleId,
          type: 'FUEL_PURCHASED',
          occurredAt: input.occurredAt,
          summary: `${input.litres} litres on card ${card.cardNumber}${evaluation.flagged ? ', over limit' : ''}`,
          payload: { transactionId: transaction.id, amount: input.amount, flagged: evaluation.flagged },
        });
      }

      return { transaction, usage: evaluation };
    });
  }

  /** Rolling daily, weekly and monthly spend for one card (FR-17). */
  async usage(cardId: string) {
    const card = await this.raw.fuelCard.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('That fuel card no longer exists.');

    const now = new Date();
    const history = await this.raw.fuelTransaction.findMany({
      where: { fuelCardId: cardId, occurredAt: { gte: new Date(now.getTime() - 31 * 86_400_000) } },
      select: { occurredAt: true, amount: true },
    });

    return evaluateFuelLimits(
      { occurredAt: now, amount: 0 },
      history.map((row) => ({ occurredAt: row.occurredAt, amount: Number(row.amount) })),
      {
        dailyLimit: card.dailyLimit ? Number(card.dailyLimit) : null,
        weeklyLimit: card.weeklyLimit ? Number(card.weeklyLimit) : null,
        monthlyLimit: card.monthlyLimit ? Number(card.monthlyLimit) : null,
      },
    );
  }
}
