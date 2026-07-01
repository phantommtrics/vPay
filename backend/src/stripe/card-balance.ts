import type { User } from '@prisma/client';

import { prisma } from '../db.js';
import { isFundSimulationEnabled } from '../fund-config.js';
import { log } from '../logger.js';
import { creditStripeFinancialAccount } from './dev-inbound-payment.js';
import { fundConnectedAccountUsdc } from './outbound-payments.js';
import { isStablecoinIssuingEnabled } from './client.js';

export type CardBalanceSource = 'stripe' | 'simulated' | 'unavailable';

export function resolveCardBalanceUsd(
  stripeBalanceUsd: number,
  simulatedBalanceUsd: number,
): { balanceUsd: number; balanceSource: CardBalanceSource } {
  const total = stripeBalanceUsd + simulatedBalanceUsd;
  if (stripeBalanceUsd > 0) {
    return { balanceUsd: total, balanceSource: 'stripe' };
  }
  if (simulatedBalanceUsd > 0) {
    return { balanceUsd: total, balanceSource: 'simulated' };
  }
  return { balanceUsd: 0, balanceSource: 'unavailable' };
}

/**
 * Credits the user's card spendable balance via Stripe when possible.
 * In dev simulation mode, falls back to users.simulated_balance_usd when Stripe is unavailable.
 */
export async function creditCardBalanceUsd(
  user: User,
  usdAmount: number,
): Promise<{
  credited: boolean;
  stripeCredited: boolean;
  simulatedBalanceUsd: number;
  balanceSource: CardBalanceSource | 'failed';
}> {
  if (usdAmount <= 0) {
    throw new Error('Invalid funding amount');
  }

  const cents = Math.round(usdAmount * 100);
  const creditAmountUsd = Math.max(cents, 1) / 100;

  let stripeCredited = false;
  try {
    if (isStablecoinIssuingEnabled()) {
      const outbound = await fundConnectedAccountUsdc(user, creditAmountUsd);
      stripeCredited = outbound.credited;
    }

    if (!stripeCredited) {
      stripeCredited = await creditStripeFinancialAccount(user, creditAmountUsd);
    }
  } catch (e) {
    log('Card fund: Stripe credit threw', {
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (stripeCredited) {
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: { simulatedBalanceUsd: true },
    });
    return {
      credited: true,
      stripeCredited: true,
      simulatedBalanceUsd: refreshed?.simulatedBalanceUsd ?? user.simulatedBalanceUsd,
      balanceSource: 'stripe',
    };
  }

  if (isFundSimulationEnabled()) {
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    if (!updated) {
      return {
        credited: false,
        stripeCredited: false,
        simulatedBalanceUsd: user.simulatedBalanceUsd,
        balanceSource: 'failed',
      };
    }

    const result = await prisma.user.update({
      where: { id: user.id },
      data: { simulatedBalanceUsd: { increment: creditAmountUsd } },
      select: { simulatedBalanceUsd: true },
    });

    log('Card fund: credited simulated balance fallback', {
      userId: user.id,
      usdAmount: creditAmountUsd,
      connectedAccountId: user.stripeConnectedAccountId,
      financialAccountId: user.stripeFinancialAccountId,
    });

    return {
      credited: true,
      stripeCredited: false,
      simulatedBalanceUsd: result.simulatedBalanceUsd,
      balanceSource: 'simulated',
    };
  }

  log('Card fund: Stripe credit failed and simulation fallback disabled', {
    userId: user.id,
    usdAmount: creditAmountUsd,
    connectedAccountId: user.stripeConnectedAccountId,
    financialAccountId: user.stripeFinancialAccountId,
  });

  return {
    credited: false,
    stripeCredited: false,
    simulatedBalanceUsd: user.simulatedBalanceUsd,
    balanceSource: 'failed',
  };
}

export async function getCardBalanceUsdForUser(user: User): Promise<{
  balanceUsd: number;
  balanceSource: CardBalanceSource;
  stripeBalanceUsd: number;
  simulatedBalanceUsd: number;
}> {
  const { getFinancialAccountBalanceUsd } = await import('./issuing.js');
  const stripeResult = await getFinancialAccountBalanceUsd(
    user.stripeFinancialAccountId,
    user.stripeConnectedAccountId,
  );
  const resolved = resolveCardBalanceUsd(stripeResult.balanceUsd, user.simulatedBalanceUsd);
  return {
    ...resolved,
    stripeBalanceUsd: stripeResult.balanceUsd,
    simulatedBalanceUsd: user.simulatedBalanceUsd,
  };
}
