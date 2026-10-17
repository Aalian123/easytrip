-- Administrator deletion.
--
-- History stays append-only for every ordinary write. The one exception is an
-- administrator deleting a whole record: DeletionsService switches on
-- `easytrip.purge` with set_config(..., true), which lasts only until its own
-- transaction ends, and removes the record together with the history that
-- belongs to it. Nothing else in the application sets this flag.
--
-- The audit trail is never deleted, even then. The deletion itself is written
-- to it, and the only change allowed is detaching a deleted user's id from
-- past entries; their name stays in "userLabel".

CREATE OR REPLACE FUNCTION easytrip_purging() RETURNS boolean AS $$
  SELECT coalesce(current_setting('easytrip.purge', true), '') = 'on';
$$ LANGUAGE sql STABLE;

-- Timelines and maintenance records: rejected unless a purge is under way.
CREATE OR REPLACE FUNCTION easytrip_reject_write() RETURNS trigger AS $$
BEGIN
  IF easytrip_purging() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% records are append-only and cannot be % (id %)',
    TG_TABLE_NAME, lower(TG_OP), coalesce(OLD.id, '');
END;
$$ LANGUAGE plpgsql;

-- The audit trail gets its own function so a purge can never delete from it.
CREATE OR REPLACE FUNCTION easytrip_protect_audit_log() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND easytrip_purging()
    AND NEW."userId" IS NULL
    AND (to_jsonb(NEW) - 'userId') = (to_jsonb(OLD) - 'userId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AuditLog records are append-only and cannot be % (id %)',
    lower(TG_OP), coalesce(OLD.id, '');
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "auditlog_append_only" ON "AuditLog";
CREATE TRIGGER "auditlog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION easytrip_protect_audit_log();

-- Submitted inspections: frozen, unless their assignment is being purged.
CREATE OR REPLACE FUNCTION easytrip_reject_submitted_inspection() RETURNS trigger AS $$
BEGIN
  IF OLD."submittedAt" IS NOT NULL AND NOT easytrip_purging() THEN
    RAISE EXCEPTION 'Inspection % was submitted on % and cannot be changed',
      OLD.id, OLD."submittedAt";
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
