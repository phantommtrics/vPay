-- CreateEnum
CREATE TYPE "BusinessEntityType" AS ENUM ('VENDOR_INCOME');

-- CreateEnum
CREATE TYPE "BusinessAccountPurpose" AS ENUM ('FEE_INCOME', 'FUND_HOLDING', 'SETTLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessAccountTxnType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable
CREATE TABLE "business_entities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessEntityType" NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_accounts" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "purpose" "BusinessAccountPurpose" NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_account_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" "BusinessAccountTxnType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance_before" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "product_code" TEXT,
    "ucp_code" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_account_transactions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "fund_holding_account_id" TEXT;

-- AlterTable
ALTER TABLE "settlement_requests" ADD COLUMN "fee_destination_account_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "business_entities_code_key" ON "business_entities"("code");

-- CreateIndex
CREATE INDEX "business_accounts_entity_id_idx" ON "business_accounts"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_accounts_entity_id_code_key" ON "business_accounts"("entity_id", "code");

-- CreateIndex
CREATE INDEX "business_account_transactions_account_id_created_at_idx" ON "business_account_transactions"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "business_account_transactions_reference_type_reference_id_idx" ON "business_account_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "products_fund_holding_account_id_idx" ON "products"("fund_holding_account_id");

-- CreateIndex
CREATE INDEX "settlement_requests_fee_destination_account_id_idx" ON "settlement_requests"("fee_destination_account_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_fund_holding_account_id_fkey" FOREIGN KEY ("fund_holding_account_id") REFERENCES "business_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_requests" ADD CONSTRAINT "settlement_requests_fee_destination_account_id_fkey" FOREIGN KEY ("fee_destination_account_id") REFERENCES "business_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_accounts" ADD CONSTRAINT "business_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "business_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_account_transactions" ADD CONSTRAINT "business_account_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "business_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
