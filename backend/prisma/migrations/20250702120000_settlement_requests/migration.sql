-- AlterTable: add code to products (backfill then enforce unique)
ALTER TABLE "products" ADD COLUMN "code" TEXT;

UPDATE "products" SET "code" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING("id", 1, 6)
WHERE "code" IS NULL;

ALTER TABLE "products" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- AlterTable: add code to ucps
ALTER TABLE "ucps" ADD COLUMN "code" TEXT;

UPDATE "ucps" SET "code" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING("id", 1, 6)
WHERE "code" IS NULL;

ALTER TABLE "ucps" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "ucps_code_key" ON "ucps"("code");

-- CreateTable
CREATE TABLE "settlement_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "product_id" TEXT NOT NULL,
    "ucp_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settlement_requests_product_id_ucp_id_key" ON "settlement_requests"("product_id", "ucp_id");
CREATE INDEX "settlement_requests_product_id_idx" ON "settlement_requests"("product_id");
CREATE INDEX "settlement_requests_ucp_id_idx" ON "settlement_requests"("ucp_id");

ALTER TABLE "settlement_requests" ADD CONSTRAINT "settlement_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_requests" ADD CONSTRAINT "settlement_requests_ucp_id_fkey" FOREIGN KEY ("ucp_id") REFERENCES "ucps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
