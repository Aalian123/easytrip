import {
  LicenceClass,
  PlateType,
  RIDER_STATUS_LABEL,
  RiderStatus,
  VEHICLE_STATUS_LABEL,
  VehicleStatus,
} from '@easytrip/shared';
import { km } from './format';

export interface StatusStyle {
  label: string;
  hex: string;
  tint: string;
}

/**
 * One place deciding what a state is called and what colour carries it. Colour
 * on screen always means a state; nothing here is decorative.
 */
const VEHICLE_STATUS_COLOUR: Record<VehicleStatus, Omit<StatusStyle, 'label'>> = {
  AVAILABLE: { hex: '#16A02E', tint: '#E8F6EB' },
  ASSIGNED: { hex: '#0B8BEE', tint: '#E8F3FE' },
  RESERVED: { hex: '#7A5AF8', tint: '#EFECFE' },
  MAINTENANCE: { hex: '#B36F00', tint: '#FBF0DC' },
  DAMAGED: { hex: '#C4502A', tint: '#FBEBE5' },
  ACCIDENT: { hex: '#D0342C', tint: '#FBE9E8' },
  OUT_OF_SERVICE: { hex: '#5F7288', tint: '#EEF2F7' },
  INACTIVE: { hex: '#5F7288', tint: '#EEF2F7' },
};

// Names come from the shared map, the same words the API writes into history.
export const VEHICLE_STATUS = Object.fromEntries(
  Object.values(VehicleStatus).map((status) => [
    status,
    { label: VEHICLE_STATUS_LABEL[status], ...VEHICLE_STATUS_COLOUR[status] },
  ]),
) as Record<VehicleStatus, StatusStyle>;

const RIDER_STATUS_COLOUR: Record<RiderStatus, Omit<StatusStyle, 'label'>> = {
  ACTIVE: { hex: '#16A02E', tint: '#E8F6EB' },
  INACTIVE: { hex: '#5F7288', tint: '#EEF2F7' },
  SUSPENDED: { hex: '#B36F00', tint: '#FBF0DC' },
  BLACKLISTED: { hex: '#D0342C', tint: '#FBE9E8' },
};

export const RIDER_STATUS: Record<string, StatusStyle> = Object.fromEntries(
  Object.values(RiderStatus).map((status) => [
    status,
    { label: RIDER_STATUS_LABEL[status], ...RIDER_STATUS_COLOUR[status] },
  ]),
);

export const CARD_STATUS: Record<string, StatusStyle> = {
  AVAILABLE: { label: 'Available', hex: '#16A02E', tint: '#E8F6EB' },
  ASSIGNED: { label: 'Issued', hex: '#0B8BEE', tint: '#E8F3FE' },
  BLOCKED: { label: 'Blocked', hex: '#D0342C', tint: '#FBE9E8' },
  LOST: { label: 'Lost', hex: '#D0342C', tint: '#FBE9E8' },
  EXPIRED: { label: 'Expired', hex: '#B36F00', tint: '#FBF0DC' },
  INACTIVE: { label: 'Inactive', hex: '#5F7288', tint: '#EEF2F7' },
};

export const GENERIC_STATUS: StatusStyle = { label: 'Unknown', hex: '#5F7288', tint: '#EEF2F7' };

export function vehicleStatus(status: string): StatusStyle {
  return VEHICLE_STATUS[status as VehicleStatus] ?? GENERIC_STATUS;
}

export function riderStatus(status: string): StatusStyle {
  return RIDER_STATUS[status] ?? GENERIC_STATUS;
}

export function cardStatus(status: string): StatusStyle {
  return CARD_STATUS[status] ?? GENERIC_STATUS;
}

/** Titles read as words, not enum shouting: UNDER_INVESTIGATION → Under investigation. */
export function sentence(value: string | null | undefined): string {
  if (!value) return '';
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export const PLATE_TYPE_LABEL: Record<PlateType, string> = {
  WHITE: 'White plate',
  YELLOW: 'Yellow plate',
};

export const LICENCE_CLASS_LABEL: Record<LicenceClass, string> = {
  MOTORBIKE: 'Motorbike',
  PRIVATE: 'Private',
  LIGHT_TRANSPORT: 'Light transport',
  HEAVY_TRANSPORT: 'Heavy transport',
};

/** How far a vehicle is from its next oil change, worded the same everywhere. */
export function oilReading(oil: { status: string; remainingKm: number | null }): { text: string; tone: string } {
  if (oil.status === 'UNKNOWN' || oil.remainingKm == null) return { text: 'Not tracked', tone: '' };
  if (oil.status === 'OVERDUE') {
    return { text: `${km(Math.abs(oil.remainingKm))} overdue`, tone: 'font-semibold text-status-accident' };
  }
  return {
    text: `due in ${km(oil.remainingKm)}`,
    tone: oil.status === 'DUE_SOON' ? 'font-semibold text-status-maintenance' : '',
  };
}
