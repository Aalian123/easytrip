-- BR-02: a vehicle can never hold more than one active assignment.
-- Prisma cannot express a partial unique index, so it is declared here and is
-- the last line of defence behind the service-level guard.
CREATE UNIQUE INDEX "one_active_assignment_per_vehicle"
  ON "VehicleAssignment" ("vehicleId")
  WHERE "status" = 'ACTIVE';

-- BR-09: a fuel card is held by at most one rider/vehicle at a time. Released
-- rows stay in the table forever as the card's holding history.
CREATE UNIQUE INDEX "one_current_holder_per_fuel_card"
  ON "FuelCardAssignment" ("fuelCardId")
  WHERE "releasedAt" IS NULL;

-- One inspection of each type per assignment: a handover happens once, a return
-- happens once, and neither can be re-run to paper over the original record.
CREATE UNIQUE INDEX "one_inspection_per_assignment_type"
  ON "Inspection" ("assignmentId", "type");

-- FR-24 / BR-05 / BR-08: history is append-only at the database level.
-- These triggers reject UPDATE and DELETE on the audit trail, the vehicle and
-- rider timelines, submitted inspections and maintenance records, whatever
-- issues the statement.
CREATE OR REPLACE FUNCTION easytrip_reject_write() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only and cannot be % (id %)',
    TG_TABLE_NAME, lower(TG_OP), coalesce(OLD.id, '');
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "auditlog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION easytrip_reject_write();

CREATE TRIGGER "vehicleevent_append_only"
  BEFORE UPDATE OR DELETE ON "VehicleEvent"
  FOR EACH ROW EXECUTE FUNCTION easytrip_reject_write();

CREATE TRIGGER "riderevent_append_only"
  BEFORE UPDATE OR DELETE ON "RiderEvent"
  FOR EACH ROW EXECUTE FUNCTION easytrip_reject_write();

CREATE TRIGGER "maintenance_append_only"
  BEFORE UPDATE OR DELETE ON "MaintenanceRecord"
  FOR EACH ROW EXECUTE FUNCTION easytrip_reject_write();

-- An inspection stays editable until it is submitted; after that it is frozen.
CREATE OR REPLACE FUNCTION easytrip_reject_submitted_inspection() RETURNS trigger AS $$
BEGIN
  IF OLD."submittedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Inspection % was submitted on % and cannot be changed',
      OLD.id, OLD."submittedAt";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inspection_frozen_after_submit"
  BEFORE UPDATE OR DELETE ON "Inspection"
  FOR EACH ROW EXECUTE FUNCTION easytrip_reject_submitted_inspection();
