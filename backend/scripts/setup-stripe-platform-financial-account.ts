/**
 * Discover or validate the platform financial account for stablecoin outbound payments.
 *
 * Usage:
 *   cd backend && npx tsx scripts/setup-stripe-platform-financial-account.ts
 *   cd backend && npx tsx scripts/setup-stripe-platform-financial-account.ts fa_...
 *
 * Stablecoin preview accounts cannot list financial accounts via API — copy the ID from
 * Dashboard → Balances → Financial accounts, then pass it as an argument to validate.
 *
 * Prints the financial account ID to add to backend/.env as:
 *   STRIPE_PLATFORM_FINANCIAL_ACCOUNT_ID=fa_...
 */
import 'dotenv/config';

import { getStripe, isStripeConfigured, stripeV2Request } from '../src/stripe/client.js';

type FinancialAccountV2 = {
  id: string;
  type?: string;
};

function printResult(financialAccountId: string): void {
  console.log('Platform financial account:', financialAccountId);
  console.log('\nAdd this to backend/.env:\n');
  console.log(`STRIPE_PLATFORM_FINANCIAL_ACCOUNT_ID=${financialAccountId}`);
}

async function validateFinancialAccountId(id: string): Promise<FinancialAccountV2 | null> {
  try {
    return await stripeV2Request<FinancialAccountV2>(
      'GET',
      `/v2/money_management/financial_accounts/${id}`,
    );
  } catch {
    return null;
  }
}

async function tryTreasuryList(): Promise<string | null> {
  try {
    const stripe = getStripe();
    const list = await stripe.treasury.financialAccounts.list({ limit: 20 });
    return list.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

function printManualInstructions(): void {
  console.error('Could not discover a platform financial account via API.');
  console.error('');
  console.error(
    'Stablecoin preview accounts do not expose a list endpoint for platform financial accounts.',
  );
  console.error('Find the ID in Stripe Dashboard → Balances → Financial accounts, then run:');
  console.error('');
  console.error('  npx tsx scripts/setup-stripe-platform-financial-account.ts fa_...');
  console.error('');
  console.error('See docs/STRIPE_STABLECOIN.md for funding the platform financial account.');
}

async function main(): Promise<void> {
  if (!isStripeConfigured()) {
    console.error('STRIPE_SECRET_KEY is not configured in backend/.env');
    process.exit(1);
  }

  const argId = process.argv[2]?.trim();
  if (argId) {
    if (!argId.startsWith('fa_')) {
      console.error('Expected a financial account ID starting with fa_');
      process.exit(1);
    }

    const account = await validateFinancialAccountId(argId);
    if (!account) {
      console.error(`Could not retrieve financial account ${argId}. Check the ID in Dashboard.`);
      process.exit(1);
    }

    printResult(account.id);
    return;
  }

  const envId = process.env.STRIPE_PLATFORM_FINANCIAL_ACCOUNT_ID?.trim();
  if (envId && !envId.includes('...')) {
    const account = await validateFinancialAccountId(envId);
    if (account) {
      printResult(account.id);
      return;
    }
  }

  const treasuryId = await tryTreasuryList();
  if (treasuryId) {
    printResult(treasuryId);
    return;
  }

  printManualInstructions();
  process.exit(1);
}

void main();
