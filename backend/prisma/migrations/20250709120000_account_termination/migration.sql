-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'TERMINATED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "original_email" TEXT;
ALTER TABLE "users" ADD COLUMN "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "terminated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");
