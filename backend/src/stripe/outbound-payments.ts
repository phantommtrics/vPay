import type { User } from '@prisma/client';

import { log } from '../logger.js';
import { getPlatformFinancialAccountId, stripeV2Request } from './client.js';

type OutboundPaymentV2 = {
  id: string;
  status?: string;
};

/**
 * Moves USD from the platform financial account to a connected account's USDC wallet.
 * This is the production path for funding stablecoin-backed cards after a user tops up.
 */
export async function fundConnectedAccountUsdc(
  user: User,
  usdAmount: number,
): Promise<{ credited: boolean; outboundPaymentId?: string }> {
  const platformFinancialAccountId = getPlatformFinancialAccountId();
  const connectedAccountId = user.stripeConnectedAccountId;
  const connectedFinancialAccountId = user.stripeFinancialAccountId;

  if (
    !platformFinancialAccountId ||
    !connectedAccountId ||
    connectedAccountId.startsWith('platform:') ||
    !connectedFinancialAccountId ||
    connectedFinancialAccountId === 'platform'
  ) {
    return { credited: false };
  }

  const cents = Math.round(usdAmount * 100);
  if (cents < 1) {
    return { credited: false };
  }

  try {
    const payment = await stripeV2Request<OutboundPaymentV2>(
      'POST',
      '/v2/money_management/outbound_payments',
      {
        from: {
          financial_account: platformFinancialAccountId,
          currency: 'usd',
        },
        to: {
          recipient: connectedAccountId,
          payout_method: connectedFinancialAccountId,
          currency: 'usdc',
        },
        amount: {
          value: cents,
          currency: 'usd',
        },
        description: `vPay card funding for user ${user.id}`,
      },
    );

    log('Stablecoin outbound payment created', {
      userId: user.id,
      outboundPaymentId: payment.id,
      status: payment.status,
      usdAmount,
    });

    return { credited: true, outboundPaymentId: payment.id };
  } catch (e) {
    log('Stablecoin outbound payment failed', {
      userId: user.id,
      usdAmount,
      error: e instanceof Error ? e.message : String(e),
    });
    return { credited: false };
  }
}
