-- CreateEnum
CREATE TYPE "DirectPayProvisioningStatus" AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "FundingOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "directpay_business_id" TEXT,
ADD COLUMN "directpay_slug" TEXT,
ADD COLUMN "directpay_provisioning_status" "DirectPayProvisioningStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "directpay_provisioning_error" TEXT;

-- CreateTable
CREATE TABLE "funding_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_gmd" DOUBLE PRECISION NOT NULL,
    "fee_gmd" DOUBLE PRECISION NOT NULL,
    "total_gmd" DOUBLE PRECISION NOT NULL,
    "usd_estimate" DOUBLE PRECISION NOT NULL,
    "status" "FundingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "directpay_order_id" TEXT,
    "directpay_order_public_code" TEXT,
    "directpay_payment_id" TEXT,
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funding_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funding_orders_user_id_idx" ON "funding_orders"("user_id");

-- CreateIndex
CREATE INDEX "funding_orders_status_idx" ON "funding_orders"("status");

-- AddForeignKey
ALTER TABLE "funding_orders" ADD CONSTRAINT "funding_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
