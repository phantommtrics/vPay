ALTER TYPE "WalletTransactionType" ADD VALUE 'CARD_UNLOAD';

CREATE TYPE "CardFundDirection" AS ENUM ('FUND', 'UNLOAD');

ALTER TABLE "card_fund_transactions" ADD COLUMN "direction" "CardFundDirection" NOT NULL DEFAULT 'FUND';
