-- AlterTable
ALTER TABLE "users" ADD COLUMN "device_lock_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "locked_device_id" TEXT;

-- CreateTable
CREATE TABLE "user_monthly_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_group_key" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "first_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_monthly_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_monthly_users" (
    "id" TEXT NOT NULL,
    "device_group_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "first_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_monthly_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_monthly_devices_user_id_year_month_idx" ON "user_monthly_devices"("user_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "user_monthly_devices_user_id_device_group_key_year_month_key" ON "user_monthly_devices"("user_id", "device_group_key", "year_month");

-- CreateIndex
CREATE INDEX "device_monthly_users_device_group_key_year_month_idx" ON "device_monthly_users"("device_group_key", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "device_monthly_users_device_group_key_user_id_year_month_key" ON "device_monthly_users"("device_group_key", "user_id", "year_month");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_locked_device_id_fkey" FOREIGN KEY ("locked_device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monthly_devices" ADD CONSTRAINT "user_monthly_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
