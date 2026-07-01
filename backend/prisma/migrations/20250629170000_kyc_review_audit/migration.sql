-- CreateEnum
CREATE TYPE "KycReviewAction" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "kyc_review_audits" (
    "id" TEXT NOT NULL,
    "customer_user_id" TEXT NOT NULL,
    "admin_user_id" TEXT,
    "action" "KycReviewAction" NOT NULL,
    "rejection_reason" TEXT,
    "customer_email" TEXT NOT NULL,
    "customer_first_name" TEXT,
    "customer_last_name" TEXT,
    "admin_email" TEXT NOT NULL,
    "admin_first_name" TEXT,
    "admin_last_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_review_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kyc_review_audits_created_at_idx" ON "kyc_review_audits"("created_at");
CREATE INDEX "kyc_review_audits_customer_user_id_idx" ON "kyc_review_audits"("customer_user_id");
CREATE INDEX "kyc_review_audits_admin_user_id_idx" ON "kyc_review_audits"("admin_user_id");
CREATE INDEX "kyc_review_audits_action_idx" ON "kyc_review_audits"("action");

ALTER TABLE "kyc_review_audits" ADD CONSTRAINT "kyc_review_audits_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kyc_review_audits" ADD CONSTRAINT "kyc_review_audits_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "admin_permissions" ("id", "module_key", "action_key", "name", "description", "created_at", "updated_at")
SELECT 'clworkflowviewperm00001', 'workflow', 'view', 'workflow:view', 'view permission for workflow', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "admin_permissions" WHERE "module_key" = 'workflow' AND "action_key" = 'view'
);

INSERT INTO "admin_role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM "admin_roles" r
INNER JOIN "admin_permissions" p ON p.module_key = 'workflow' AND p.action_key = 'view'
WHERE r.name = 'Owner'
ON CONFLICT DO NOTHING;
