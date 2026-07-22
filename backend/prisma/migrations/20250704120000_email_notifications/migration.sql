-- CreateEnum
CREATE TYPE "EmailNotificationTemplate" AS ENUM ('OTP_SIGN_IN', 'WELCOME', 'CARD_READY');

-- CreateEnum
CREATE TYPE "EmailNotificationAudience" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EmailNotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "email_notifications" (
    "id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_user_id" TEXT,
    "template" "EmailNotificationTemplate" NOT NULL,
    "audience" "EmailNotificationAudience" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailNotificationStatus" NOT NULL,
    "resend_message_id" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_notifications_created_at_idx" ON "email_notifications"("created_at");

-- CreateIndex
CREATE INDEX "email_notifications_recipient_email_created_at_idx" ON "email_notifications"("recipient_email", "created_at");

-- CreateIndex
CREATE INDEX "email_notifications_template_created_at_idx" ON "email_notifications"("template", "created_at");

-- CreateIndex
CREATE INDEX "email_notifications_status_created_at_idx" ON "email_notifications"("status", "created_at");

-- AddForeignKey
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
