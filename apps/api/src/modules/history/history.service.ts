import { Injectable } from '@nestjs/common';
import { Prisma, RiderEventType, VehicleEventType } from '@prisma/client';
import { currentContext } from '../../context/request-context';
import { TxClient } from '../../prisma/prisma.service';

export interface VehicleEventInput {
  vehicleId: string;
  type: VehicleEventType;
  summary: string;
  payload?: Prisma.InputJsonValue;
  assignmentId?: string | null;
  occurredAt?: Date;
}

export interface RiderEventInput {
  riderId: string;
  type: RiderEventType;
  summary: string;
  payload?: Prisma.InputJsonValue;
  occurredAt?: Date;
}

/**
 * Timeline entries worth showing. A status change made by a handover or return
 * only repeats the handover or return entry beside it, so it is kept on file
 * but left out of what people read.
 */
export const SHOWN_VEHICLE_EVENTS: Prisma.VehicleEventWhereInput = {
  NOT: { type: 'STATUS_CHANGED', assignmentId: { not: null } },
};

/**
 * The only writer of the vehicle and rider timelines (FR-07).
 *
 * Every method takes the transaction client of the change it describes, so an
 * event and the record it refers to are committed together or not at all.
 * Timeline rows are never updated or deleted — the database enforces that.
 */
@Injectable()
export class HistoryService {
  async recordVehicleEvent(tx: TxClient, input: VehicleEventInput): Promise<void> {
    await tx.vehicleEvent.create({
      data: {
        vehicleId: input.vehicleId,
        type: input.type,
        summary: input.summary,
        payload: input.payload ?? Prisma.JsonNull,
        assignmentId: input.assignmentId ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        actorId: currentContext().userId ?? null,
      },
    });
  }

  async recordRiderEvent(tx: TxClient, input: RiderEventInput): Promise<void> {
    await tx.riderEvent.create({
      data: {
        riderId: input.riderId,
        type: input.type,
        summary: input.summary,
        payload: input.payload ?? Prisma.JsonNull,
        occurredAt: input.occurredAt ?? new Date(),
        actorId: currentContext().userId ?? null,
      },
    });
  }
}
