-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('INTERNAL', 'EXTERNAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "ServiceBehaviour" AS ENUM ('TRANSACTIONAL', 'NON_TRANSACTIONAL');

-- CreateEnum
CREATE TYPE "DenominationUnitType" AS ENUM ('FLEX', 'FIXED');

-- CreateEnum
CREATE TYPE "ProductUnitType" AS ENUM ('MONETARY', 'NON_MONETARY');

-- CreateEnum
CREATE TYPE "UcpUnit" AS ENUM ('FEES', 'REWARD', 'SETTLEMENT', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "UcpType" AS ENUM ('FIXED', 'SLAB');

-- CreateEnum
CREATE TYPE "UcpCalculationType" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "UcpSlabValueType" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ServiceType" NOT NULL,
    "behaviour" "ServiceBehaviour" NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "service_id" TEXT NOT NULL,
    "denomination_unit_type" "DenominationUnitType" NOT NULL,
    "product_unit_type" "ProductUnitType" NOT NULL,
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ucps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "UcpUnit" NOT NULL,
    "ucp_type" "UcpType" NOT NULL,
    "calculation_type" "UcpCalculationType" NOT NULL,
    "allow_debit_on_successful_transaction" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "fixed_value" DOUBLE PRECISION,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ucps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ucp_slabs" (
    "id" TEXT NOT NULL,
    "ucp_id" TEXT NOT NULL,
    "min_amount" DOUBLE PRECISION NOT NULL,
    "max_amount" DOUBLE PRECISION,
    "value" DOUBLE PRECISION NOT NULL,
    "value_type" "UcpSlabValueType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ucp_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE INDEX "products_service_id_idx" ON "products"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_service_id_name_key" ON "products"("service_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ucps_name_key" ON "ucps"("name");

-- CreateIndex
CREATE INDEX "ucp_slabs_ucp_id_idx" ON "ucp_slabs"("ucp_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ucp_slabs" ADD CONSTRAINT "ucp_slabs_ucp_id_fkey" FOREIGN KEY ("ucp_id") REFERENCES "ucps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
