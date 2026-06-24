-- CreateEnum
CREATE TYPE "StripeProvisioningStatus" AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "VirtualCardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "country_code" TEXT,
ADD COLUMN "postal_code" TEXT,
ADD COLUMN "card_terms_accepted_at" TIMESTAMP(3),
ADD COLUMN "card_terms_accepted_ip" TEXT,
ADD COLUMN "stripe_connected_account_id" TEXT,
ADD COLUMN "stripe_financial_account_id" TEXT,
ADD COLUMN "stripe_provisioning_status" "StripeProvisioningStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "stripe_provisioning_error" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_connected_account_id_key" ON "users"("stripe_connected_account_id");

-- CreateTable
CREATE TABLE "virtual_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_card_id" TEXT NOT NULL,
    "stripe_cardholder_id" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'visa',
    "exp_month" INTEGER NOT NULL,
    "exp_year" INTEGER NOT NULL,
    "status" "VirtualCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "virtual_cards_stripe_card_id_key" ON "virtual_cards"("stripe_card_id");

-- CreateIndex
CREATE INDEX "virtual_cards_user_id_idx" ON "virtual_cards"("user_id");

-- AddForeignKey
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
