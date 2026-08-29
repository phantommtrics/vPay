CREATE TYPE "AppLockCredentialType" AS ENUM ('PIN', 'PASSWORD');

ALTER TABLE "users"
  ADD COLUMN "app_lock_type" "AppLockCredentialType",
  ADD COLUMN "app_lock_secret_hash" TEXT,
  ADD COLUMN "app_lock_failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "app_lock_locked_until" TIMESTAMP(3);
