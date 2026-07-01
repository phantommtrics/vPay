-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'CARD_ISSUANCE';

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "card_issuance_paid_at" TIMESTAMP(3),
ADD COLUMN "card_issuance_fee_usd" DOUBLE PRECISION,
ADD COLUMN "card_issuance_wallet_tx_id" TEXT;
