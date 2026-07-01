-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "device_name" TEXT,
    "brand" TEXT,
    "manufacturer" TEXT,
    "model_name" TEXT,
    "device_type" TEXT,
    "os_name" TEXT,
    "os_version" TEXT,
    "imei" TEXT,
    "hardware_id" TEXT,
    "is_emulator" BOOLEAN NOT NULL DEFAULT false,
    "app_version" TEXT,
    "last_ip_address" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "funding_orders" ADD COLUMN "device_id" TEXT;

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN "device_id" TEXT;

-- AlterTable
ALTER TABLE "card_fund_transactions" ADD COLUMN "device_id" TEXT;

-- CreateIndex
CREATE INDEX "user_devices_user_id_last_seen_at_idx" ON "user_devices"("user_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_fingerprint_key" ON "user_devices"("user_id", "fingerprint");

-- CreateIndex
CREATE INDEX "funding_orders_device_id_idx" ON "funding_orders"("device_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_device_id_idx" ON "wallet_transactions"("device_id");

-- CreateIndex
CREATE INDEX "card_fund_transactions_device_id_idx" ON "card_fund_transactions"("device_id");

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_orders" ADD CONSTRAINT "funding_orders_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_fund_transactions" ADD CONSTRAINT "card_fund_transactions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
