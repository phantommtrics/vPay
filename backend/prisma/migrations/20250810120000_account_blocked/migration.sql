-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "blocked_reason" TEXT;
