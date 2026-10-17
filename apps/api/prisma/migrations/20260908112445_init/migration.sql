-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FLEET_MANAGER', 'ACCOUNTS', 'RIDER', 'VIEWER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'RESERVED', 'MAINTENANCE', 'DAMAGED', 'ACCIDENT', 'OUT_OF_SERVICE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('HANDOVER', 'RETURN');

-- CreateEnum
CREATE TYPE "DamageCategory" AS ENUM ('SCRATCH', 'DENT', 'GLASS', 'TYRE', 'INTERIOR', 'MECHANICAL', 'ELECTRICAL', 'MISSING_ACCESSORY', 'OTHER');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'REPAIRED', 'WRITTEN_OFF', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ResponsibleParty" AS ENUM ('RIDER', 'THIRD_PARTY', 'SHARED', 'COMPANY', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "AccidentStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'INSURANCE_SUBMITTED', 'UNDER_REPAIR', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'BRAKE_PADS', 'TYRES', 'BATTERY', 'SUSPENSION', 'GENERAL_SERVICE', 'REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelCardStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'BLOCKED', 'LOST', 'EXPIRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('REGISTRATION', 'HANDOVER', 'RETURN', 'ACCIDENT', 'DAMAGE', 'MAINTENANCE', 'REPAIR', 'INSPECTION');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('VEHICLE', 'RIDER');

-- CreateEnum
CREATE TYPE "VehicleEventType" AS ENUM ('VEHICLE_ADDED', 'STATUS_CHANGED', 'ASSIGNED', 'HANDOVER_INSPECTED', 'RETURNED', 'RETURN_INSPECTED', 'DAMAGE_RECORDED', 'ACCIDENT_REPORTED', 'ACCIDENT_UPDATED', 'MAINTENANCE_PERFORMED', 'OIL_CHANGED', 'FUEL_CARD_ASSIGNED', 'FUEL_CARD_RELEASED', 'FUEL_PURCHASED', 'DOCUMENT_ADDED', 'RENTAL_CHARGED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "RiderEventType" AS ENUM ('RIDER_ADDED', 'STATUS_CHANGED', 'VEHICLE_ASSIGNED', 'VEHICLE_RETURNED', 'FUEL_CARD_ASSIGNED', 'FUEL_CARD_RELEASED', 'ACCIDENT_REPORTED', 'DAMAGE_RECORDED', 'DOCUMENT_ADDED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('OIL_CHANGE_DUE', 'MAINTENANCE_DUE', 'INSURANCE_EXPIRING', 'REGISTRATION_EXPIRING', 'LICENCE_EXPIRING', 'DOCUMENT_EXPIRING', 'VEHICLE_OVERDUE', 'FUEL_CARD_EXPIRING', 'FUEL_LIMIT_REACHED', 'ACCIDENT_REPORTED', 'DAMAGE_REPORTED', 'VEHICLE_RETURNED', 'VEHICLE_AVAILABLE');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "riderId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "currentMileage" INTEGER NOT NULL DEFAULT 0,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "lastOilChangeDate" TIMESTAMP(3),
    "lastOilChangeMileage" INTEGER,
    "oilChangeIntervalKm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRate" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "dailyRate" DECIMAL(12,2) NOT NULL,
    "weeklyRate" DECIMAL(12,2),
    "monthlyRate" DECIMAL(12,2),
    "securityDeposit" DECIMAL(12,2),
    "lateReturnFeePerDay" DECIMAL(12,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactNumber" TEXT,
    "licenceNumber" TEXT,
    "licenceIssuedAt" TIMESTAMP(3),
    "licenceExpiresAt" TIMESTAMP(3),
    "employmentStatus" TEXT,
    "status" "RiderStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "expectedReturnAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "startMileage" INTEGER NOT NULL,
    "startFuelLevel" INTEGER,
    "endMileage" INTEGER,
    "endFuelLevel" INTEGER,
    "rateSnapshot" JSONB,
    "fuelCardId" TEXT,
    "notes" TEXT,
    "returnNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fuelLevel" INTEGER,
    "checklist" JSONB NOT NULL,
    "existingDamageNotes" TEXT,
    "accessoriesNotes" TEXT,
    "documentsProvided" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "riderId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Damage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "riderId" TEXT,
    "assignmentId" TEXT,
    "accidentId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "category" "DamageCategory" NOT NULL,
    "severity" "DamageSeverity" NOT NULL DEFAULT 'MINOR',
    "description" TEXT NOT NULL,
    "estimatedCost" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),
    "responsibleParty" "ResponsibleParty" NOT NULL DEFAULT 'UNDETERMINED',
    "repairStatus" "RepairStatus" NOT NULL DEFAULT 'PENDING',
    "chargedToRider" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Damage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accident" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "riderId" TEXT,
    "assignmentId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riderStatement" TEXT,
    "thirdParty" JSONB,
    "policeReport" TEXT,
    "insuranceInfo" TEXT,
    "estimatedRepairCost" DECIMAL(12,2),
    "actualRepairCost" DECIMAL(12,2),
    "responsibility" "ResponsibleParty" NOT NULL DEFAULT 'UNDETERMINED',
    "managementComments" TEXT,
    "status" "AccidentStatus" NOT NULL DEFAULT 'REPORTED',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER NOT NULL,
    "serviceProvider" TEXT,
    "partsReplaced" TEXT,
    "description" TEXT,
    "cost" DECIMAL(12,2),
    "invoiceUrl" TEXT,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceMileage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelCard" (
    "id" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "FuelCardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "dailyLimit" DECIMAL(12,2),
    "weeklyLimit" DECIMAL(12,2),
    "monthlyLimit" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelCardAssignment" (
    "id" TEXT NOT NULL,
    "fuelCardId" TEXT NOT NULL,
    "riderId" TEXT,
    "vehicleId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelCardAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTransaction" (
    "id" TEXT NOT NULL,
    "fuelCardId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "riderId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "station" TEXT,
    "litres" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vehicleMileage" INTEGER,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCharge" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "billedDays" INTEGER NOT NULL,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "lateFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fuelCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "damageCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trafficFines" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLink" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OTHER',
    "category" "MediaCategory" NOT NULL,
    "description" TEXT,
    "vehicleId" TEXT,
    "riderId" TEXT,
    "assignmentId" TEXT,
    "inspectionId" TEXT,
    "accidentId" TEXT,
    "damageId" TEXT,
    "maintenanceId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleEvent" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "VehicleEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "assignmentId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderEvent" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "type" "RiderEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "dueAt" TIMESTAMP(3),
    "targetRole" "Role",
    "targetUserId" TEXT,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userLabel" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "organizationName" TEXT NOT NULL DEFAULT 'EasyTrip Fleet',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "nationalIdLabel" TEXT NOT NULL DEFAULT 'ID number',
    "defaultOilIntervalKm" INTEGER NOT NULL DEFAULT 5000,
    "oilWarnWithinKm" INTEGER NOT NULL DEFAULT 500,
    "alertLeadDays" INTEGER NOT NULL DEFAULT 30,
    "allowMultipleActiveAssignments" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_riderId_key" ON "User"("riderId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registration_key" ON "Vehicle"("registration");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_registration_idx" ON "Vehicle"("registration");

-- CreateIndex
CREATE INDEX "RentalRate_vehicleId_effectiveFrom_idx" ON "RentalRate"("vehicleId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_nationalId_key" ON "Rider"("nationalId");

-- CreateIndex
CREATE INDEX "Rider_status_idx" ON "Rider"("status");

-- CreateIndex
CREATE INDEX "Rider_fullName_idx" ON "Rider"("fullName");

-- CreateIndex
CREATE INDEX "VehicleAssignment_vehicleId_status_idx" ON "VehicleAssignment"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "VehicleAssignment_riderId_status_idx" ON "VehicleAssignment"("riderId", "status");

-- CreateIndex
CREATE INDEX "VehicleAssignment_assignedAt_idx" ON "VehicleAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "Inspection_assignmentId_type_idx" ON "Inspection"("assignmentId", "type");

-- CreateIndex
CREATE INDEX "Inspection_vehicleId_idx" ON "Inspection"("vehicleId");

-- CreateIndex
CREATE INDEX "Reservation_vehicleId_startsAt_idx" ON "Reservation"("vehicleId", "startsAt");

-- CreateIndex
CREATE INDEX "Damage_vehicleId_detectedAt_idx" ON "Damage"("vehicleId", "detectedAt");

-- CreateIndex
CREATE INDEX "Damage_assignmentId_idx" ON "Damage"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Accident_reference_key" ON "Accident"("reference");

-- CreateIndex
CREATE INDEX "Accident_vehicleId_occurredAt_idx" ON "Accident"("vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "Accident_status_idx" ON "Accident"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_performedAt_idx" ON "MaintenanceRecord"("vehicleId", "performedAt");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_type_idx" ON "MaintenanceRecord"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FuelCard_cardNumber_key" ON "FuelCard"("cardNumber");

-- CreateIndex
CREATE INDEX "FuelCard_status_idx" ON "FuelCard"("status");

-- CreateIndex
CREATE INDEX "FuelCardAssignment_fuelCardId_assignedAt_idx" ON "FuelCardAssignment"("fuelCardId", "assignedAt");

-- CreateIndex
CREATE INDEX "FuelCardAssignment_riderId_idx" ON "FuelCardAssignment"("riderId");

-- CreateIndex
CREATE INDEX "FuelTransaction_fuelCardId_occurredAt_idx" ON "FuelTransaction"("fuelCardId", "occurredAt");

-- CreateIndex
CREATE INDEX "FuelTransaction_vehicleId_occurredAt_idx" ON "FuelTransaction"("vehicleId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentalCharge_assignmentId_key" ON "RentalCharge"("assignmentId");

-- CreateIndex
CREATE INDEX "RentalCharge_vehicleId_createdAt_idx" ON "RentalCharge"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "RentalCharge_paymentStatus_idx" ON "RentalCharge"("paymentStatus");

-- CreateIndex
CREATE INDEX "MediaLink_vehicleId_category_idx" ON "MediaLink"("vehicleId", "category");

-- CreateIndex
CREATE INDEX "MediaLink_assignmentId_idx" ON "MediaLink"("assignmentId");

-- CreateIndex
CREATE INDEX "Document_ownerType_ownerId_idx" ON "Document"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE INDEX "VehicleEvent_vehicleId_occurredAt_idx" ON "VehicleEvent"("vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "VehicleEvent_type_idx" ON "VehicleEvent"("type");

-- CreateIndex
CREATE INDEX "RiderEvent_riderId_occurredAt_idx" ON "RiderEvent"("riderId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_targetRole_readAt_idx" ON "Notification"("targetRole", "readAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_recordType_recordId_idx" ON "AuditLog"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRate" ADD CONSTRAINT "RentalRate_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "FuelCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VehicleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VehicleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Damage" ADD CONSTRAINT "Damage_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accident" ADD CONSTRAINT "Accident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accident" ADD CONSTRAINT "Accident_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accident" ADD CONSTRAINT "Accident_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VehicleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelCardAssignment" ADD CONSTRAINT "FuelCardAssignment_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "FuelCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelCardAssignment" ADD CONSTRAINT "FuelCardAssignment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelCardAssignment" ADD CONSTRAINT "FuelCardAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_fuelCardId_fkey" FOREIGN KEY ("fuelCardId") REFERENCES "FuelCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VehicleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VehicleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_damageId_fkey" FOREIGN KEY ("damageId") REFERENCES "Damage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "MaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEvent" ADD CONSTRAINT "VehicleEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEvent" ADD CONSTRAINT "VehicleEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "VehicleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEvent" ADD CONSTRAINT "VehicleEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEvent" ADD CONSTRAINT "RiderEvent_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEvent" ADD CONSTRAINT "RiderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
