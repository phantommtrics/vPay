-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone_e164" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");
