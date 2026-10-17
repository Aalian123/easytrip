-- Plate colour and the licence a rider needs to drive the vehicle.

CREATE TYPE "PlateType" AS ENUM ('WHITE', 'YELLOW');
CREATE TYPE "LicenceClass" AS ENUM ('MOTORBIKE', 'PRIVATE', 'LIGHT_TRANSPORT', 'HEAVY_TRANSPORT');

ALTER TABLE "Vehicle"
  ADD COLUMN "plateType" "PlateType" NOT NULL DEFAULT 'WHITE',
  ADD COLUMN "licenceClass" "LicenceClass" NOT NULL DEFAULT 'PRIVATE';

-- Existing two-wheelers were recorded by category; give them the matching licence.
UPDATE "Vehicle" SET "licenceClass" = 'MOTORBIKE'
  WHERE lower("category") IN ('motorcycle', 'motorbike', 'bike', 'scooter');
