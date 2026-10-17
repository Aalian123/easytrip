-- Engine oil recorded through ordinary servicing used to leave the vehicle's
-- oil counters untouched, so the vehicle read "not tracked". Take the latest
-- such record wherever it is newer than what the vehicle holds.

UPDATE "Vehicle" v
SET "lastOilChangeMileage" = latest.mileage,
    "lastOilChangeDate" = latest."performedAt"
FROM (
  SELECT DISTINCT ON ("vehicleId") "vehicleId", mileage, "performedAt"
  FROM "MaintenanceRecord"
  WHERE type = 'ENGINE_OIL'
  ORDER BY "vehicleId", mileage DESC, "performedAt" DESC
) latest
WHERE v.id = latest."vehicleId"
  AND (v."lastOilChangeMileage" IS NULL OR latest.mileage > v."lastOilChangeMileage");
