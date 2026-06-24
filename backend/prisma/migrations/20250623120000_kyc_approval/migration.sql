-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('INCOMPLETE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "kyc_status" "KycStatus" NOT NULL DEFAULT 'INCOMPLETE';
ALTER TABLE "users" ADD COLUMN "document_type" TEXT;
ALTER TABLE "users" ADD COLUMN "document_front_url" TEXT;
ALTER TABLE "users" ADD COLUMN "document_back_url" TEXT;
ALTER TABLE "users" ADD COLUMN "kyc_submitted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "kyc_rejection_reason" TEXT;

-- Users who were auto-verified keep approved status
UPDATE "users" SET "kyc_status" = 'APPROVED' WHERE "kyc_complete" = true;
UPDATE "users" SET "kyc_status" = 'PENDING' WHERE "kyc_complete" = false AND "first_name" IS NOT NULL AND "phone" IS NOT NULL;
