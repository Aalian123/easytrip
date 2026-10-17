/**
 * Single source of truth for every enum in the product.
 * Values mirror the Prisma enums exactly — keep both in step.
 */

export const Role = {
  ADMIN: 'ADMIN',
  FLEET_MANAGER: 'FLEET_MANAGER',
  ACCOUNTS: 'ACCOUNTS',
  RIDER: 'RIDER',
  VIEWER: 'VIEWER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const VehicleStatus = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  RESERVED: 'RESERVED',
  MAINTENANCE: 'MAINTENANCE',
  DAMAGED: 'DAMAGED',
  ACCIDENT: 'ACCIDENT',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
  INACTIVE: 'INACTIVE',
} as const;
export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

/**
 * What each vehicle status is called, everywhere: the screens and the history
 * text the API writes. One map, so a timeline never says "In use" beside a chip
 * that says "On the road".
 */
export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  AVAILABLE: 'Available',
  ASSIGNED: 'On the road',
  RESERVED: 'Reserved',
  MAINTENANCE: 'In maintenance',
  DAMAGED: 'Damaged',
  ACCIDENT: 'Accident',
  OUT_OF_SERVICE: 'Off the road',
  INACTIVE: 'Retired',
};

/** Statuses only a handover or a return may set or leave. */
export const ASSIGNMENT_OWNED_STATUSES: VehicleStatus[] = [VehicleStatus.ASSIGNED];

/** Statuses that count as "on the road with a rider" for KPI purposes. */
export const IN_USE_STATUSES: VehicleStatus[] = [VehicleStatus.ASSIGNED];

export const PlateType = {
  WHITE: 'WHITE',
  YELLOW: 'YELLOW',
} as const;
export type PlateType = (typeof PlateType)[keyof typeof PlateType];

/** The driving licence a rider must hold to take the vehicle out. */
export const LicenceClass = {
  MOTORBIKE: 'MOTORBIKE',
  PRIVATE: 'PRIVATE',
  LIGHT_TRANSPORT: 'LIGHT_TRANSPORT',
  HEAVY_TRANSPORT: 'HEAVY_TRANSPORT',
} as const;
export type LicenceClass = (typeof LicenceClass)[keyof typeof LicenceClass];

export const RiderStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  BLACKLISTED: 'BLACKLISTED',
} as const;
export type RiderStatus = (typeof RiderStatus)[keyof typeof RiderStatus];

export const RIDER_STATUS_LABEL: Record<RiderStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  BLACKLISTED: 'Blacklisted',
};

/** A rider in any of these states must not be handed a vehicle. */
export const RIDER_BLOCKED_STATUSES: RiderStatus[] = [
  RiderStatus.SUSPENDED,
  RiderStatus.BLACKLISTED,
  RiderStatus.INACTIVE,
];

export const AssignmentStatus = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const InspectionType = {
  HANDOVER: 'HANDOVER',
  RETURN: 'RETURN',
} as const;
export type InspectionType = (typeof InspectionType)[keyof typeof InspectionType];

/** Condition grades used by every checklist row in an inspection. */
export const ConditionGrade = {
  OK: 'OK',
  MINOR: 'MINOR',
  DAMAGE: 'DAMAGE',
  NA: 'NA',
} as const;
export type ConditionGrade = (typeof ConditionGrade)[keyof typeof ConditionGrade];

/** The checklist rows from PRD §11, in the order they are shown on the form. */
export const CHECKLIST_ITEMS = [
  { key: 'exterior', label: 'Exterior body' },
  { key: 'interior', label: 'Interior' },
  { key: 'tyres', label: 'Tyres' },
  { key: 'lights', label: 'Lights' },
  { key: 'mirrors', label: 'Mirrors' },
  { key: 'windows', label: 'Windows and glass' },
  { key: 'scratches', label: 'Scratches' },
  { key: 'dents', label: 'Dents' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'documents', label: 'Documents in vehicle' },
] as const;
export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]['key'];

export const DamageSeverity = {
  MINOR: 'MINOR',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
} as const;
export type DamageSeverity = (typeof DamageSeverity)[keyof typeof DamageSeverity];

export const DamageCategory = {
  SCRATCH: 'SCRATCH',
  DENT: 'DENT',
  GLASS: 'GLASS',
  TYRE: 'TYRE',
  INTERIOR: 'INTERIOR',
  MECHANICAL: 'MECHANICAL',
  ELECTRICAL: 'ELECTRICAL',
  MISSING_ACCESSORY: 'MISSING_ACCESSORY',
  OTHER: 'OTHER',
} as const;
export type DamageCategory = (typeof DamageCategory)[keyof typeof DamageCategory];

export const RepairStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  REPAIRED: 'REPAIRED',
  WRITTEN_OFF: 'WRITTEN_OFF',
  NOT_REQUIRED: 'NOT_REQUIRED',
} as const;
export type RepairStatus = (typeof RepairStatus)[keyof typeof RepairStatus];

export const ResponsibleParty = {
  RIDER: 'RIDER',
  THIRD_PARTY: 'THIRD_PARTY',
  SHARED: 'SHARED',
  COMPANY: 'COMPANY',
  UNDETERMINED: 'UNDETERMINED',
} as const;
export type ResponsibleParty = (typeof ResponsibleParty)[keyof typeof ResponsibleParty];

export const AccidentStatus = {
  REPORTED: 'REPORTED',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  INSURANCE_SUBMITTED: 'INSURANCE_SUBMITTED',
  UNDER_REPAIR: 'UNDER_REPAIR',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type AccidentStatus = (typeof AccidentStatus)[keyof typeof AccidentStatus];

export const MaintenanceType = {
  ENGINE_OIL: 'ENGINE_OIL',
  OIL_FILTER: 'OIL_FILTER',
  AIR_FILTER: 'AIR_FILTER',
  BRAKE_PADS: 'BRAKE_PADS',
  TYRES: 'TYRES',
  BATTERY: 'BATTERY',
  SUSPENSION: 'SUSPENSION',
  GENERAL_SERVICE: 'GENERAL_SERVICE',
  REPAIR: 'REPAIR',
  OTHER: 'OTHER',
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

export const FuelCardStatus = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  BLOCKED: 'BLOCKED',
  LOST: 'LOST',
  EXPIRED: 'EXPIRED',
  INACTIVE: 'INACTIVE',
} as const;
export type FuelCardStatus = (typeof FuelCardStatus)[keyof typeof FuelCardStatus];

/** BR-12: a card in any of these states can never be handed out. */
export const FUEL_CARD_UNASSIGNABLE: FuelCardStatus[] = [
  FuelCardStatus.BLOCKED,
  FuelCardStatus.LOST,
  FuelCardStatus.EXPIRED,
  FuelCardStatus.INACTIVE,
];

export const MediaCategory = {
  REGISTRATION: 'REGISTRATION',
  HANDOVER: 'HANDOVER',
  RETURN: 'RETURN',
  ACCIDENT: 'ACCIDENT',
  DAMAGE: 'DAMAGE',
  MAINTENANCE: 'MAINTENANCE',
  REPAIR: 'REPAIR',
  INSPECTION: 'INSPECTION',
} as const;
export type MediaCategory = (typeof MediaCategory)[keyof typeof MediaCategory];

export const DocumentOwnerType = {
  VEHICLE: 'VEHICLE',
  RIDER: 'RIDER',
} as const;
export type DocumentOwnerType = (typeof DocumentOwnerType)[keyof typeof DocumentOwnerType];

export const VehicleDocumentType = {
  REGISTRATION: 'REGISTRATION',
  INSURANCE: 'INSURANCE',
  TAX_TOKEN: 'TAX_TOKEN',
  INSPECTION_CERTIFICATE: 'INSPECTION_CERTIFICATE',
  FITNESS_CERTIFICATE: 'FITNESS_CERTIFICATE',
  PURCHASE: 'PURCHASE',
  MAINTENANCE_INVOICE: 'MAINTENANCE_INVOICE',
  ACCIDENT_REPORT: 'ACCIDENT_REPORT',
  OTHER: 'OTHER',
} as const;
export type VehicleDocumentType =
  (typeof VehicleDocumentType)[keyof typeof VehicleDocumentType];

export const RiderDocumentType = {
  NATIONAL_ID: 'NATIONAL_ID',
  PASSPORT: 'PASSPORT',
  DRIVING_LICENCE: 'DRIVING_LICENCE',
  EMPLOYMENT: 'EMPLOYMENT',
  AGREEMENT: 'AGREEMENT',
  OTHER: 'OTHER',
} as const;
export type RiderDocumentType = (typeof RiderDocumentType)[keyof typeof RiderDocumentType];

/** Append-only vehicle timeline entries (FR-07). */
export const VehicleEventType = {
  VEHICLE_ADDED: 'VEHICLE_ADDED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNED: 'ASSIGNED',
  HANDOVER_INSPECTED: 'HANDOVER_INSPECTED',
  RETURNED: 'RETURNED',
  RETURN_INSPECTED: 'RETURN_INSPECTED',
  DAMAGE_RECORDED: 'DAMAGE_RECORDED',
  ACCIDENT_REPORTED: 'ACCIDENT_REPORTED',
  ACCIDENT_UPDATED: 'ACCIDENT_UPDATED',
  MAINTENANCE_PERFORMED: 'MAINTENANCE_PERFORMED',
  OIL_CHANGED: 'OIL_CHANGED',
  FUEL_CARD_ASSIGNED: 'FUEL_CARD_ASSIGNED',
  FUEL_CARD_RELEASED: 'FUEL_CARD_RELEASED',
  FUEL_PURCHASED: 'FUEL_PURCHASED',
  DOCUMENT_ADDED: 'DOCUMENT_ADDED',
  RENTAL_CHARGED: 'RENTAL_CHARGED',
  NOTE_ADDED: 'NOTE_ADDED',
} as const;
export type VehicleEventType = (typeof VehicleEventType)[keyof typeof VehicleEventType];

export const RiderEventType = {
  RIDER_ADDED: 'RIDER_ADDED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  VEHICLE_ASSIGNED: 'VEHICLE_ASSIGNED',
  VEHICLE_RETURNED: 'VEHICLE_RETURNED',
  FUEL_CARD_ASSIGNED: 'FUEL_CARD_ASSIGNED',
  FUEL_CARD_RELEASED: 'FUEL_CARD_RELEASED',
  ACCIDENT_REPORTED: 'ACCIDENT_REPORTED',
  DAMAGE_RECORDED: 'DAMAGE_RECORDED',
  DOCUMENT_ADDED: 'DOCUMENT_ADDED',
} as const;
export type RiderEventType = (typeof RiderEventType)[keyof typeof RiderEventType];

export const NotificationType = {
  OIL_CHANGE_DUE: 'OIL_CHANGE_DUE',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  INSURANCE_EXPIRING: 'INSURANCE_EXPIRING',
  REGISTRATION_EXPIRING: 'REGISTRATION_EXPIRING',
  LICENCE_EXPIRING: 'LICENCE_EXPIRING',
  DOCUMENT_EXPIRING: 'DOCUMENT_EXPIRING',
  VEHICLE_OVERDUE: 'VEHICLE_OVERDUE',
  FUEL_CARD_EXPIRING: 'FUEL_CARD_EXPIRING',
  FUEL_LIMIT_REACHED: 'FUEL_LIMIT_REACHED',
  ACCIDENT_REPORTED: 'ACCIDENT_REPORTED',
  DAMAGE_REPORTED: 'DAMAGE_REPORTED',
  VEHICLE_RETURNED: 'VEHICLE_RETURNED',
  VEHICLE_AVAILABLE: 'VEHICLE_AVAILABLE',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type NotificationSeverity =
  (typeof NotificationSeverity)[keyof typeof NotificationSeverity];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  WAIVED: 'WAIVED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
