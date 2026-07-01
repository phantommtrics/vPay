-- AlterTable
ALTER TABLE "users" ADD COLUMN "admin_user" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "admin_totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "admin_totp_enabled_at" TIMESTAMP(3);
