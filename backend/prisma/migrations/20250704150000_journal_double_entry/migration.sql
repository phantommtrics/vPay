-- CreateEnum
CREATE TYPE "JournalAccountType" AS ENUM ('CUSTOMER_WALLET', 'BUSINESS_ACCOUNT');

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_type" "JournalAccountType" NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wallet_transaction_id" TEXT,
    "business_account_transaction_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "business_account_transactions" ADD COLUMN "journal_entry_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reference_type_reference_id_key" ON "journal_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "journal_entries_posted_at_idx" ON "journal_entries"("posted_at");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_type_account_id_idx" ON "journal_lines"("account_type", "account_id");

-- CreateIndex
CREATE INDEX "journal_lines_wallet_transaction_id_idx" ON "journal_lines"("wallet_transaction_id");

-- CreateIndex
CREATE INDEX "business_account_transactions_journal_entry_id_idx" ON "business_account_transactions"("journal_entry_id");

-- AddForeignKey
ALTER TABLE "business_account_transactions" ADD CONSTRAINT "business_account_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
