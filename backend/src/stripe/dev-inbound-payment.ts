import type { User } from '@prisma/client';
import type Stripe from 'stripe';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import { getStripe, stripePreviewVersion, stripeV2Request } from './client.js';

type InboundTransferV2 = {
  id: string;
  status?: string;
};

type InboundTransferV1 = {
  id: string;
  status: string;
};

/**
 * Ensures a verified US bank account payment method exists on the connected account
 * for dev inbound transfers. Caches the ID on the user row.
 */
export async function ensureDevInboundPaymentMethod(user: User): Promise<string | null> {
  const fromEnv = process.env.STRIPE_TEST_INBOUND_PAYMENT_METHOD?.trim();
  if (fromEnv) return fromEnv;

  if (user.stripeTestInboundPaymentMethod) {
    return user.stripeTestInboundPaymentMethod;
  }

  if (
    !user.stripeConnectedAccountId ||
    user.stripeConnectedAccountId.startsWith('platform:')
  ) {
    return null;
  }

  const stripe = getStripe();
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'vPay Dev User';

  try {
    const setupIntent = await stripe.setupIntents.create(
      {
        attach_to_self: true,
        flow_directions: ['inbound'],
        payment_method_types: ['us_bank_account'],
        payment_method_data: {
          type: 'us_bank_account',
          us_bank_account: {
            routing_number: '110000000',
            account_number: '000123456789',
            account_holder_type: 'individual',
          },
          billing_details: { name },
        },
        confirm: true,
        mandate_data: {
          customer_acceptance: {
            type: 'online',
            online: { ip_address: '127.0.0.1', user_agent: 'vPay-dev-simulation' },
          },
        },
      },
      { stripeAccount: user.stripeConnectedAccountId },
    );

    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      log('Dev inbound PM: SetupIntent did not return a payment method', {
        userId: user.id,
        status: setupIntent.status,
      });
      return null;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeTestInboundPaymentMethod: paymentMethodId },
    });

    log('Dev inbound PM: created and cached test payment method', {
      userId: user.id,
      paymentMethodId,
    });

    return paymentMethodId;
  } catch (e) {
    log('Dev inbound PM: SetupIntent failed', {
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function succeedTreasuryInboundTransfer(
  stripe: Stripe,
  transferId: string,
  connectedAccountId: string,
): Promise<void> {
  try {
    await stripe.testHelpers.treasury.inboundTransfers.succeed(transferId, undefined, {
      stripeAccount: connectedAccountId,
    });
  } catch {
    // Transfer may already be succeeded in test mode
  }
}

async function creditViaTreasuryV1(
  stripe: Stripe,
  connectedAccountId: string,
  financialAccountId: string,
  paymentMethodId: string,
  cents: number,
): Promise<boolean> {
  const transfer = await stripe.treasury.inboundTransfers.create(
    {
      amount: cents,
      currency: 'usd',
      financial_account: financialAccountId,
      origin_payment_method: paymentMethodId,
      description: 'vPay dev fund simulation',
    },
    { stripeAccount: connectedAccountId },
  );

  if (transfer.status === 'processing') {
    await succeedTreasuryInboundTransfer(stripe, transfer.id, connectedAccountId);
  }

  log('Dev fund simulation: Treasury v1 inbound transfer', {
    transferId: transfer.id,
    status: transfer.status,
  });

  return true;
}

async function creditViaMoneyManagementV2(
  connectedAccountId: string,
  financialAccountId: string,
  paymentMethodId: string,
  cents: number,
): Promise<boolean> {
  for (const currency of ['usdc', 'usd'] as const) {
    try {
      const transfer = await stripeV2Request<InboundTransferV2>(
        'POST',
        '/v2/money_management/inbound_transfers',
        {
          description: 'vPay dev fund simulation',
          from: { payment_method: paymentMethodId },
          to: {
            financial_account: financialAccountId,
            currency,
          },
          amount: {
            value: cents,
            currency,
          },
        },
        { stripeAccount: connectedAccountId },
      );

      log('Dev fund simulation: v2 inbound transfer created', {
        transferId: transfer.id,
        currency,
        status: transfer.status,
      });

      return true;
    } catch (e) {
      log('Dev fund simulation: v2 inbound transfer failed', {
        currency,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return false;
}

/**
 * Credits the user's Stripe financial account in development using inbound transfers.
 * Returns true when Stripe accepted the transfer request.
 */
export async function creditStripeFinancialAccount(
  user: User,
  usdAmount: number,
): Promise<boolean> {
  if (
    !user.stripeFinancialAccountId ||
    user.stripeFinancialAccountId === 'platform' ||
    !user.stripeConnectedAccountId ||
    user.stripeConnectedAccountId.startsWith('platform:')
  ) {
    return false;
  }

  const paymentMethodId = await ensureDevInboundPaymentMethod(user);
  if (!paymentMethodId) {
    return false;
  }

  const cents = Math.round(usdAmount * 100);
  const stripe = getStripe();

  // Treasury v1 + test helper succeed is the most reliable in Stripe test mode.
  try {
    return await creditViaTreasuryV1(
      stripe,
      user.stripeConnectedAccountId,
      user.stripeFinancialAccountId,
      paymentMethodId,
      cents,
    );
  } catch (e) {
    log('Dev fund simulation: Treasury v1 failed, trying v2', {
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
      apiVersion: stripePreviewVersion,
    });
  }

  // Fallback: try pm_usBankAccount test token directly on Treasury v1
  try {
    return await creditViaTreasuryV1(
      stripe,
      user.stripeConnectedAccountId,
      user.stripeFinancialAccountId,
      'pm_usBankAccount',
      cents,
    );
  } catch (e) {
    log('Dev fund simulation: Treasury v1 with pm_usBankAccount failed', {
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return creditViaMoneyManagementV2(
    user.stripeConnectedAccountId,
    user.stripeFinancialAccountId,
    paymentMethodId,
    cents,
  );
}
