import type { User } from '@prisma/client';

import { log } from '../logger.js';
import { isFundSimulationEnabled } from '../fund-config.js';
import { prisma } from '../db.js';
import { creditStripeFinancialAccount } from './dev-inbound-payment.js';

/**
 * In development, credit the user's Stripe financial account when possible,
 * and fall back to a local simulated balance for card display.
 */
export async function creditSimulatedCardFunding(user: User, usdAmount: number): Promise<{
  stripeCredited: boolean;
  simulatedBalanceUsd: number;
  stripePaymentMethodId?: string;
}> {
  if (!isFundSimulationEnabled()) {
    throw new Error('Simulated funding is only available in development');
  }

  if (usdAmount <= 0) {
    throw new Error('Invalid funding amount');
  }

  let stripeCredited = false;
  let stripePaymentMethodId: string | undefined;

  if (
    user.stripeFinancialAccountId &&
    user.stripeFinancialAccountId !== 'platform' &&
    user.stripeConnectedAccountId &&
    !user.stripeConnectedAccountId.startsWith('platform:')
  ) {
    stripePaymentMethodId =
      user.stripeTestInboundPaymentMethod ??
      process.env.STRIPE_TEST_INBOUND_PAYMENT_METHOD?.trim() ??
      undefined;

    try {
      stripeCredited = await creditStripeFinancialAccount(user, usdAmount);
      if (stripeCredited) {
        const refreshed = await prisma.user.findUnique({
          where: { id: user.id },
          select: { stripeTestInboundPaymentMethod: true, simulatedBalanceUsd: true },
        });
        stripePaymentMethodId = refreshed?.stripeTestInboundPaymentMethod ?? stripePaymentMethodId;
        log('Dev fund simulation: Stripe financial account credited', {
          userId: user.id,
          usdAmount,
          paymentMethodId: stripePaymentMethodId,
        });
        return {
          stripeCredited: true,
          simulatedBalanceUsd: refreshed?.simulatedBalanceUsd ?? user.simulatedBalanceUsd,
          stripePaymentMethodId,
        };
      }
    } catch (e) {
      log('Dev fund simulation: Stripe credit failed, using simulated balance', {
        userId: user.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      simulatedBalanceUsd: { increment: usdAmount },
    },
    select: { simulatedBalanceUsd: true, stripeTestInboundPaymentMethod: true },
  });

  return {
    stripeCredited: false,
    simulatedBalanceUsd: updated.simulatedBalanceUsd,
    stripePaymentMethodId: updated.stripeTestInboundPaymentMethod ?? stripePaymentMethodId,
  };
}
