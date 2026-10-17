import { z } from 'zod';
import {
  AccidentStatus,
  ConditionGrade,
  DamageCategory,
  DamageSeverity,
  DocumentOwnerType,
  FuelCardStatus,
  InspectionType,
  LicenceClass,
  MaintenanceType,
  MediaCategory,
  PaymentStatus,
  PlateType,
  RepairStatus,
  ResponsibleParty,
  RiderStatus,
  Role,
  VehicleStatus,
} from './enums';
import { isSafeExternalUrl } from './url';

/** Shared primitives ------------------------------------------------------ */

export const externalUrlSchema = z
  .string()
  .trim()
  .min(1, 'Paste a link')
  .refine(isSafeExternalUrl, 'Enter a full http:// or https:// link');

export const optionalDateSchema = z.coerce.date().optional().nullable();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({ id: z.string().uuid() });

/** Auth ------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(Role),
  riderId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.partial().omit({ password: true });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Vehicles --------------------------------------------------------------- */

export const createVehicleSchema = z.object({
  registration: z.string().trim().min(2, 'Registration is required').max(24),
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  color: z.string().trim().min(1),
  category: z.string().trim().min(1),
  plateType: z
    .nativeEnum(PlateType, { errorMap: () => ({ message: 'Choose a white or yellow plate' }) })
    .default(PlateType.WHITE),
  licenceClass: z
    .nativeEnum(LicenceClass, { errorMap: () => ({ message: 'Choose the licence a rider needs' }) })
    .default(LicenceClass.PRIVATE),
  engineNumber: z.string().trim().optional().nullable(),
  chassisNumber: z.string().trim().optional().nullable(),
  purchaseDate: optionalDateSchema,
  currentMileage: z.coerce.number().int().min(0).default(0),
  oilChangeIntervalKm: z.coerce.number().int().min(0).optional().nullable(),
  lastOilChangeMileage: z.coerce.number().int().min(0).optional().nullable(),
  lastOilChangeDate: optionalDateSchema,
  notes: z.string().trim().optional().nullable(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

// Mileage and oil readings move only through handovers, returns, servicing and
// fuel, which keep them from going backwards and record why they changed.
export const updateVehicleSchema = createVehicleSchema
  .omit({ currentMileage: true, lastOilChangeMileage: true, lastOilChangeDate: true })
  .partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const vehicleQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(VehicleStatus).optional(),
  q: z.string().trim().optional(),
  sort: z.enum(['registration', 'createdAt', 'currentMileage']).default('registration'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});
export type VehicleQuery = z.infer<typeof vehicleQuerySchema>;

export const changeVehicleStatusSchema = z.object({
  status: z.nativeEnum(VehicleStatus),
  reason: z.string().trim().max(500).optional().nullable(),
});

/** Rental rates ----------------------------------------------------------- */

export const rentalRateSchema = z.object({
  dailyRate: z.coerce.number().min(0),
  weeklyRate: z.coerce.number().min(0).optional().nullable(),
  monthlyRate: z.coerce.number().min(0).optional().nullable(),
  securityDeposit: z.coerce.number().min(0).optional().nullable(),
  lateReturnFeePerDay: z.coerce.number().min(0).optional().nullable(),
  effectiveFrom: z.coerce.date().default(() => new Date()),
});
export type RentalRateInput = z.infer<typeof rentalRateSchema>;

/** Riders ----------------------------------------------------------------- */

export const createRiderSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required'),
  nationalId: z.string().trim().min(4, 'Identification number is required'),
  contactNumber: z.string().trim().min(5),
  address: z.string().trim().optional().nullable(),
  emergencyContactName: z.string().trim().optional().nullable(),
  emergencyContactNumber: z.string().trim().optional().nullable(),
  licenceNumber: z.string().trim().optional().nullable(),
  licenceIssuedAt: optionalDateSchema,
  licenceExpiresAt: optionalDateSchema,
  employmentStatus: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export type CreateRiderInput = z.infer<typeof createRiderSchema>;

export const updateRiderSchema = createRiderSchema.partial();

export const riderQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(RiderStatus).optional(),
  q: z.string().trim().optional(),
});

export const changeRiderStatusSchema = z.object({
  status: z.nativeEnum(RiderStatus),
  reason: z.string().trim().max(500).optional().nullable(),
});

/** Media links and documents ---------------------------------------------- */

export const createMediaLinkSchema = z.object({
  url: externalUrlSchema,
  category: z.nativeEnum(MediaCategory),
  description: z.string().trim().max(300).optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
  riderId: z.string().uuid().optional().nullable(),
  assignmentId: z.string().uuid().optional().nullable(),
  inspectionId: z.string().uuid().optional().nullable(),
  accidentId: z.string().uuid().optional().nullable(),
  damageId: z.string().uuid().optional().nullable(),
  maintenanceId: z.string().uuid().optional().nullable(),
});
export type CreateMediaLinkInput = z.infer<typeof createMediaLinkSchema>;

export const createDocumentSchema = z.object({
  ownerType: z.nativeEnum(DocumentOwnerType),
  ownerId: z.string().uuid(),
  docType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: externalUrlSchema,
  issuedAt: optionalDateSchema,
  expiresAt: optionalDateSchema,
  notes: z.string().trim().max(500).optional().nullable(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** Settings --------------------------------------------------------------- */

export const updateSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).optional(),
  currencyCode: z.string().trim().length(3).optional(),
  currencySymbol: z.string().trim().min(1).max(4).optional(),
  nationalIdLabel: z.string().trim().min(2).max(40).optional(),
  defaultOilIntervalKm: z.coerce.number().int().min(100).optional(),
  oilWarnWithinKm: z.coerce.number().int().min(0).optional(),
  alertLeadDays: z.coerce.number().int().min(1).max(180).optional(),
  allowMultipleActiveAssignments: z.boolean().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Assignments and inspections ------------------------------------------- */

export const fuelLevelSchema = z.coerce
  .number()
  .int()
  .min(0, 'Fuel level runs from empty (0) to full (8)')
  .max(8, 'Fuel level runs from empty (0) to full (8)');

export const createAssignmentSchema = z.object({
  vehicleId: z.string().uuid('Choose a vehicle'),
  riderId: z.string().uuid('Choose a rider'),
  assignedAt: z.coerce.date().default(() => new Date()),
  expectedReturnAt: optionalDateSchema,
  startMileage: z.coerce.number().int().min(0),
  startFuelLevel: fuelLevelSchema.optional().nullable(),
  fuelCardId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const checklistEntrySchema = z.object({
  grade: z.nativeEnum(ConditionGrade),
  note: z.string().trim().max(300).optional().nullable(),
});

export const checklistSchema = z.record(z.string(), checklistEntrySchema);
export type Checklist = z.infer<typeof checklistSchema>;

export const createInspectionSchema = z.object({
  type: z.nativeEnum(InspectionType),
  mileage: z.coerce.number().int().min(0),
  fuelLevel: fuelLevelSchema.optional().nullable(),
  checklist: checklistSchema,
  existingDamageNotes: z.string().trim().max(1000).optional().nullable(),
  accessoriesNotes: z.string().trim().max(1000).optional().nullable(),
  documentsProvided: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
  mediaUrls: z.array(externalUrlSchema).max(20).default([]),
});
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;

export const newDamageSchema = z.object({
  category: z.nativeEnum(DamageCategory),
  severity: z.nativeEnum(DamageSeverity).default('MINOR'),
  description: z.string().trim().min(3, 'Describe the damage'),
  estimatedCost: z.coerce.number().min(0).optional().nullable(),
  responsibleParty: z.nativeEnum(ResponsibleParty).default('UNDETERMINED'),
  chargedToRider: z.boolean().default(false),
  mediaUrls: z.array(externalUrlSchema).max(20).default([]),
});
export type NewDamageInput = z.infer<typeof newDamageSchema>;

export const returnVehicleSchema = z.object({
  returnedAt: z.coerce.date().default(() => new Date()),
  endMileage: z.coerce.number().int().min(0),
  endFuelLevel: fuelLevelSchema.optional().nullable(),
  returnNotes: z.string().trim().max(1000).optional().nullable(),
  inspection: createInspectionSchema.omit({ type: true }).optional(),
  newDamages: z.array(newDamageSchema).default([]),
  fuelCharge: z.coerce.number().min(0).default(0),
  damageCharge: z.coerce.number().min(0).default(0),
  trafficFines: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  vehicleStatusAfter: z
    .enum(['AVAILABLE', 'MAINTENANCE', 'DAMAGED', 'ACCIDENT', 'OUT_OF_SERVICE'])
    .default('AVAILABLE'),
  releaseFuelCard: z.boolean().default(true),
});
export type ReturnVehicleInput = z.infer<typeof returnVehicleSchema>;

export const assignmentQuerySchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'RETURNED', 'CANCELLED']).optional(),
  vehicleId: z.string().uuid().optional(),
  riderId: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
});

/** Incidents -------------------------------------------------------------- */

export const createDamageSchema = newDamageSchema.extend({
  vehicleId: z.string().uuid(),
  riderId: z.string().uuid().optional().nullable(),
  assignmentId: z.string().uuid().optional().nullable(),
  accidentId: z.string().uuid().optional().nullable(),
  detectedAt: z.coerce.date().default(() => new Date()),
});
export type CreateDamageInput = z.infer<typeof createDamageSchema>;

export const updateDamageSchema = z.object({
  severity: z.nativeEnum(DamageSeverity).optional(),
  description: z.string().trim().min(3).optional(),
  estimatedCost: z.coerce.number().min(0).optional().nullable(),
  actualCost: z.coerce.number().min(0).optional().nullable(),
  responsibleParty: z.nativeEnum(ResponsibleParty).optional(),
  repairStatus: z.nativeEnum(RepairStatus).optional(),
  chargedToRider: z.boolean().optional(),
});

export const createAccidentSchema = z.object({
  vehicleId: z.string().uuid('Choose the vehicle involved'),
  riderId: z.string().uuid().optional().nullable(),
  assignmentId: z.string().uuid().optional().nullable(),
  occurredAt: z.coerce.date(),
  location: z.string().trim().min(2, 'Where did it happen?'),
  description: z.string().trim().min(5, 'Describe what happened'),
  riderStatement: z.string().trim().max(4000).optional().nullable(),
  thirdParty: z
    .object({
      name: z.string().trim().optional().nullable(),
      contact: z.string().trim().optional().nullable(),
      vehicle: z.string().trim().optional().nullable(),
      insurer: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
  policeReport: externalUrlSchema.optional().nullable(),
  insuranceInfo: z.string().trim().max(1000).optional().nullable(),
  estimatedRepairCost: z.coerce.number().min(0).optional().nullable(),
  mediaUrls: z.array(externalUrlSchema).max(20).default([]),
});
export type CreateAccidentInput = z.infer<typeof createAccidentSchema>;

export const updateAccidentSchema = z.object({
  status: z.nativeEnum(AccidentStatus).optional(),
  responsibility: z.nativeEnum(ResponsibleParty).optional(),
  managementComments: z.string().trim().max(2000).optional().nullable(),
  estimatedRepairCost: z.coerce.number().min(0).optional().nullable(),
  actualRepairCost: z.coerce.number().min(0).optional().nullable(),
  insuranceInfo: z.string().trim().max(1000).optional().nullable(),
  policeReport: externalUrlSchema.optional().nullable(),
});
export type UpdateAccidentInput = z.infer<typeof updateAccidentSchema>;

/** Maintenance ------------------------------------------------------------ */

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().uuid(),
  type: z.nativeEnum(MaintenanceType),
  performedAt: z.coerce.date().default(() => new Date()),
  mileage: z.coerce.number().int().min(0),
  serviceProvider: z.string().trim().max(200).optional().nullable(),
  partsReplaced: z.string().trim().max(1000).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  invoiceUrl: externalUrlSchema.optional().nullable(),
  nextServiceDate: optionalDateSchema,
  nextServiceMileage: z.coerce.number().int().min(0).optional().nullable(),
  /** Engine oil only: how far until the next change. Blank keeps the vehicle's own. */
  intervalKm: z.coerce.number().int().min(100).optional().nullable(),
  mediaUrls: z.array(externalUrlSchema).max(20).default([]),
});
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;

/** Fuel ------------------------------------------------------------------- */

export const createFuelCardSchema = z.object({
  cardNumber: z.string().trim().min(4, 'Card number is required'),
  provider: z.string().trim().min(1, 'Who issued the card?'),
  expiryDate: optionalDateSchema,
  dailyLimit: z.coerce.number().min(0).optional().nullable(),
  weeklyLimit: z.coerce.number().min(0).optional().nullable(),
  monthlyLimit: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type CreateFuelCardInput = z.infer<typeof createFuelCardSchema>;

export const updateFuelCardSchema = createFuelCardSchema.partial().extend({
  status: z.nativeEnum(FuelCardStatus).optional(),
});

export const assignFuelCardSchema = z
  .object({
    riderId: z.string().uuid().optional().nullable(),
    vehicleId: z.string().uuid().optional().nullable(),
    assignedAt: z.coerce.date().default(() => new Date()),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((value) => Boolean(value.riderId || value.vehicleId), {
    message: 'Choose a rider, a vehicle, or both',
    path: ['riderId'],
  });
export type AssignFuelCardInput = z.infer<typeof assignFuelCardSchema>;

export const createFuelTransactionSchema = z.object({
  fuelCardId: z.string().uuid(),
  vehicleId: z.string().uuid().optional().nullable(),
  riderId: z.string().uuid().optional().nullable(),
  occurredAt: z.coerce.date().default(() => new Date()),
  station: z.string().trim().max(200).optional().nullable(),
  litres: z.coerce.number().positive('Enter the litres purchased'),
  amount: z.coerce.number().positive('Enter the amount paid'),
  vehicleMileage: z.coerce.number().int().min(0).optional().nullable(),
  receiptUrl: externalUrlSchema.optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type CreateFuelTransactionInput = z.infer<typeof createFuelTransactionSchema>;

/** Money ------------------------------------------------------------------ */

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().min(0),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
});

/** Reports ---------------------------------------------------------------- */

export const reportQuerySchema = paginationSchema.extend({
  from: optionalDateSchema,
  to: optionalDateSchema,
  vehicleId: z.string().uuid().optional(),
  riderId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  format: z.enum(['json', 'xlsx', 'pdf']).default('json'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
