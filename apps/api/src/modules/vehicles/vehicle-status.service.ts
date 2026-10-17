import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleStatus } from '@prisma/client';
import { VEHICLE_STATUS_LABEL } from '@easytrip/shared';
import { HistoryService } from '../history/history.service';
import { TxClient } from '../../prisma/prisma.service';

/**
 * The single place a vehicle's status changes (PRD §36).
 *
 * Services never write `vehicle.status` themselves — they call transition(),
 * which checks the move is legal and records it on the timeline in the same
 * transaction.
 */
const ALLOWED: Record<VehicleStatus, VehicleStatus[]> = {
  AVAILABLE: ['ASSIGNED', 'RESERVED', 'MAINTENANCE', 'DAMAGED', 'ACCIDENT', 'OUT_OF_SERVICE', 'INACTIVE'],
  ASSIGNED: ['AVAILABLE', 'MAINTENANCE', 'DAMAGED', 'ACCIDENT', 'OUT_OF_SERVICE'],
  RESERVED: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'],
  MAINTENANCE: ['AVAILABLE', 'DAMAGED', 'ACCIDENT', 'OUT_OF_SERVICE', 'INACTIVE'],
  DAMAGED: ['MAINTENANCE', 'AVAILABLE', 'ACCIDENT', 'OUT_OF_SERVICE', 'INACTIVE'],
  ACCIDENT: ['MAINTENANCE', 'DAMAGED', 'AVAILABLE', 'OUT_OF_SERVICE', 'INACTIVE'],
  OUT_OF_SERVICE: ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'],
  INACTIVE: ['AVAILABLE', 'OUT_OF_SERVICE'],
};

export const STATUS_LABELS: Record<VehicleStatus, string> = VEHICLE_STATUS_LABEL;

@Injectable()
export class VehicleStatusService {
  constructor(private readonly history: HistoryService) {}

  canTransition(from: VehicleStatus, to: VehicleStatus): boolean {
    return from === to || ALLOWED[from].includes(to);
  }

  async transition(
    tx: TxClient,
    vehicleId: string,
    to: VehicleStatus,
    reason?: string | null,
    assignmentId?: string | null,
  ): Promise<void> {
    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, status: true, registration: true },
    });
    if (!vehicle) throw new NotFoundException('That vehicle no longer exists.');
    if (vehicle.status === to) return;

    if (!this.canTransition(vehicle.status, to)) {
      throw new ConflictException(
        `A vehicle that is ${STATUS_LABELS[vehicle.status].toLowerCase()} cannot move straight to ${STATUS_LABELS[to].toLowerCase()}.`,
      );
    }

    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: to } });

    await this.history.recordVehicleEvent(tx, {
      vehicleId,
      type: 'STATUS_CHANGED',
      summary: reason
        ? `${STATUS_LABELS[vehicle.status]} to ${STATUS_LABELS[to]}: ${reason}`
        : `${STATUS_LABELS[vehicle.status]} to ${STATUS_LABELS[to]}`,
      payload: { from: vehicle.status, to, reason: reason ?? null },
      assignmentId,
    });
  }
}
