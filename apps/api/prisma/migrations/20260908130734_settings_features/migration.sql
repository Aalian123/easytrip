-- DropIndex
DROP INDEX "one_inspection_per_assignment_type";

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "features" JSONB;
