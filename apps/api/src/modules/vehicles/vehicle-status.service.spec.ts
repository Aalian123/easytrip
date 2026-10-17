import { VehicleStatus } from '@prisma/client';
import { VehicleStatusService } from './vehicle-status.service';
import { HistoryService } from '../history/history.service';

/**
 * The transition table is the shape of the vehicle lifecycle in the brief, so
 * it is worth asserting directly rather than only through the API.
 */
describe('VehicleStatusService transition table', () => {
  const service = new VehicleStatusService(new HistoryService());

  it('lets an available vehicle go out, be reserved, or go for service', () => {
    for (const to of ['ASSIGNED', 'RESERVED', 'MAINTENANCE', 'DAMAGED'] as VehicleStatus[]) {
      expect(service.canTransition('AVAILABLE', to)).toBe(true);
    }
  });

  it('lets a vehicle in use come back, or come back broken', () => {
    expect(service.canTransition('ASSIGNED', 'AVAILABLE')).toBe(true);
    expect(service.canTransition('ASSIGNED', 'DAMAGED')).toBe(true);
    expect(service.canTransition('ASSIGNED', 'MAINTENANCE')).toBe(true);
  });

  it('refuses to hand out a vehicle that is not free', () => {
    expect(service.canTransition('MAINTENANCE', 'ASSIGNED')).toBe(false);
    expect(service.canTransition('DAMAGED', 'ASSIGNED')).toBe(false);
    expect(service.canTransition('ACCIDENT', 'ASSIGNED')).toBe(false);
    expect(service.canTransition('INACTIVE', 'ASSIGNED')).toBe(false);
  });

  it('refuses to move a vehicle straight from in use to reserved', () => {
    expect(service.canTransition('ASSIGNED', 'RESERVED')).toBe(false);
  });

  it('treats staying put as allowed', () => {
    expect(service.canTransition('AVAILABLE', 'AVAILABLE')).toBe(true);
  });

  it('brings a repaired vehicle back into service', () => {
    expect(service.canTransition('DAMAGED', 'MAINTENANCE')).toBe(true);
    expect(service.canTransition('MAINTENANCE', 'AVAILABLE')).toBe(true);
  });
});
