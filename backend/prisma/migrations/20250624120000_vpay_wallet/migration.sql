-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('DEPOSIT', 'CARD_FUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CardFundTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "vpay_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "balance_gmd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpay_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount_gmd" DOUBLE PRECISION NOT NULL,
    "balance_before_gmd" DOUBLE PRECISION NOT NULL,
    "balance_after_gmd" DOUBLE PRECISION NOT NULL,
    "usd_estimate" DOUBLE PRECISION,
    "exchange_rate" DOUBLE PRECISION,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_fund_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_transaction_id" TEXT NOT NULL,
    "amount_gmd" DOUBLE PRECISION NOT NULL,
    "amount_usd" DOUBLE PRECISION NOT NULL,
    "exchange_rate" DOUBLE PRECISION NOT NULL,
    "stripe_balance_before_usd" DOUBLE PRECISION NOT NULL,
    "stripe_balance_after_usd" DOUBLE PRECISION NOT NULL,
    "gmd_estimate_before" DOUBLE PRECISION NOT NULL,
    "gmd_estimate_after" DOUBLE PRECISION NOT NULL,
    "stripe_credited" BOOLEAN NOT NULL DEFAULT false,
    "stripe_transfer_id" TEXT,
    "status" "CardFundTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_fund_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpay_wallets_user_id_key" ON "vpay_wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vpay_wallets_phone_number_key" ON "vpay_wallets"("phone_number");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_fund_transactions_wallet_transaction_id_key" ON "card_fund_transactions"("wallet_transaction_id");

-- CreateIndex
CREATE INDEX "card_fund_transactions_user_id_created_at_idx" ON "card_fund_transactions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "vpay_wallets" ADD CONSTRAINT "vpay_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "vpay_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_fund_transactions" ADD CONSTRAINT "card_fund_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_fund_transactions" ADD CONSTRAINT "card_fund_transactions_wallet_transaction_id_fkey" FOREIGN KEY ("wallet_transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
