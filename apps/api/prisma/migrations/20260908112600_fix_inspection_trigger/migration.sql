-- A BEFORE DELETE trigger that returns NEW cancels the delete silently, which
-- would hide a bug rather than surface it. Return the right row per operation.
CREATE OR REPLACE FUNCTION easytrip_reject_submitted_inspection() RETURNS trigger AS $$
BEGIN
  IF OLD."submittedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Inspection % was submitted on % and cannot be changed',
      OLD.id, OLD."submittedAt";
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
