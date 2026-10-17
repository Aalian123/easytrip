-- Feature switches are read from the environment now, so the stored copy goes.
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "features";
