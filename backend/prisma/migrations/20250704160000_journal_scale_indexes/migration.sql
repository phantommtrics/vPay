-- Denormalized totals for fast journal list queries at scale
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "total_debit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "total_credit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "line_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill totals from existing lines
UPDATE "journal_entries" je
SET
  "total_debit" = totals.debit_sum,
  "total_credit" = totals.credit_sum,
  "line_count" = totals.line_count
FROM (
  SELECT
    "journal_entry_id",
    COALESCE(SUM("debit"), 0) AS debit_sum,
    COALESCE(SUM("credit"), 0) AS credit_sum,
    COUNT(*)::integer AS line_count
  FROM "journal_lines"
  GROUP BY "journal_entry_id"
) AS totals
WHERE je.id = totals.journal_entry_id;

-- Composite indexes for cursor pagination and aggregations
CREATE INDEX IF NOT EXISTS "journal_entries_posted_at_id_idx" ON "journal_entries"("posted_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "business_account_transactions_account_created_id_idx"
  ON "business_account_transactions"("account_id", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "journal_lines_account_type_account_id_idx"
  ON "journal_lines"("account_type", "account_id");

CREATE INDEX IF NOT EXISTS "journal_lines_journal_entry_id_sort_order_idx"
  ON "journal_lines"("journal_entry_id", "sort_order");
