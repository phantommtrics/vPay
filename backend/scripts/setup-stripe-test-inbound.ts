/**
 * Discover or create the Stripe test inbound payment method for dev funding.
 *
 * Usage:
 *   cd backend && npx tsx scripts/setup-stripe-test-inbound.ts user@example.com
 *
 * Prints the payment method ID to add to backend/.env as:
 *   STRIPE_TEST_INBOUND_PAYMENT_METHOD=pm_...
 */
import 'dotenv/config';

import { prisma } from '../src/db.js';
import { ensureDevInboundPaymentMethod } from '../src/stripe/dev-inbound-payment.js';
import { isStripeConfigured } from '../src/stripe/client.js';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npx tsx scripts/setup-stripe-test-inbound.ts <user-email>');
    process.exit(1);
  }

  if (!isStripeConfigured()) {
    console.error('STRIPE_SECRET_KEY is not configured in backend/.env');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (!user.stripeConnectedAccountId || user.stripeConnectedAccountId.startsWith('platform:')) {
    console.error('User has no Stripe connected account. Run admin provision first.');
    process.exit(1);
  }

  if (!user.stripeFinancialAccountId || user.stripeFinancialAccountId === 'platform') {
    console.error('User has no Stripe financial account. Run admin provision first.');
    process.exit(1);
  }

  console.log('Connected account:', user.stripeConnectedAccountId);
  console.log('Financial account:', user.stripeFinancialAccountId);

  const paymentMethodId = await ensureDevInboundPaymentMethod(user);
  if (!paymentMethodId) {
    console.error('Could not create a test inbound payment method. Check Stripe logs.');
    process.exit(1);
  }

  console.log('\nSuccess! Add this to backend/.env (optional — auto-cached on user otherwise):\n');
  console.log(`STRIPE_TEST_INBOUND_PAYMENT_METHOD=${paymentMethodId}`);
}

void main().finally(() => prisma.$disconnect());
