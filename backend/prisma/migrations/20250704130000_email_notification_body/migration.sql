-- AlterTable
ALTER TABLE "email_notifications" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';

-- Remove default after backfill (existing rows have empty body)
ALTER TABLE "email_notifications" ALTER COLUMN "body" DROP DEFAULT;
