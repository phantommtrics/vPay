-- CreateEnum
CREATE TYPE "ExchangeRateSyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "exchange_rate_snapshots" (
    "id" TEXT NOT NULL,
    "status" "ExchangeRateSyncStatus" NOT NULL,
    "rate" DOUBLE PRECISION,
    "base_currency" TEXT NOT NULL,
    "target_currency" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "source_updated_at_utc" TIMESTAMP(3),
    "http_status" INTEGER,
    "catalog_updated" BOOLEAN NOT NULL DEFAULT false,
    "previous_rate" DOUBLE PRECISION,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_requested_at_idx" ON "exchange_rate_snapshots"("requested_at");

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_status_requested_at_idx" ON "exchange_rate_snapshots"("status", "requested_at");

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_target_currency_requested_at_idx" ON "exchange_rate_snapshots"("target_currency", "requested_at");
