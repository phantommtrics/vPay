-- AlterTable
ALTER TABLE "users" ADD COLUMN "kyc_submitted_device_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_kyc_submitted_device_id_fkey" FOREIGN KEY ("kyc_submitted_device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
