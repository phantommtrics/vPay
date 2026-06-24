-- Dev-only simulated card balance (credited when FUND_SIMULATION is enabled)
ALTER TABLE "users" ADD COLUMN "simulated_balance_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;
