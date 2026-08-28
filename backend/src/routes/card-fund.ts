import crypto from 'node:crypto';
import type { Response } from 'express';
import { CardFundDirection, CardFundTransactionStatus, StripeProvisioningStatus } from '@prisma/client';
import { z } from 'zod';

import { CardUnloadError, unloadCardBalanceToWallet } from '../card-fund/service.js';
import { prisma } from '../db.js';
import { postCardFundJournal } from '../journal/service.js';
import { getFundConfigAsync } from '../fund-config.js';
import { calculateCardFundFee } from '../settlement/platform-config.js';
import { creditCardBalanceUsd, getCardBalanceUsdForUser } from '../stripe/card-balance.js';
import {
  creditWallet,
  debitWallet,
  getWalletBalance,
  InsufficientWalletBalanceError,
  WalletNotFoundError,
} from '../wallet/service.js';
import { WalletTransactionType } from '@prisma/client';
import type { AuthedRequest } from './auth.js';
import type { DeviceAuthedRequest } from '../middleware/device.js';

const fundCardSchema = z.object({
  amountGmd: z.number().positive(),
});

function toPublicCardFundTransaction(tx: {
  id: string;
  amountGmd: number;
  feeGmd: number;
  amountUsd: number;
  exchangeRate: number;
  stripeBalanceBeforeUsd: number;
  stripeBalanceAfterUsd: number;
  gmdEstimateBefore: number;
  gmdEstimateAfter: number;
  stripeCredited: boolean;
  direction?: CardFundDirection;
  status: CardFundTransactionStatus;
  createdAt: Date;
}) {
  return {
    id: tx.id,
    amountGmd: tx.amountGmd,
    feeGmd: tx.feeGmd,
    totalGmd: tx.amountGmd + tx.feeGmd,
    amountUsd: tx.amountUsd,
    exchangeRate: tx.exchangeRate,
    stripeBalanceBeforeUsd: tx.stripeBalanceBeforeUsd,
    stripeBalanceAfterUsd: tx.stripeBalanceAfterUsd,
    gmdEstimateBefore: tx.gmdEstimateBefore,
    gmdEstimateAfter: tx.gmdEstimateAfter,
    stripeCredited: tx.stripeCredited,
    direction: (tx.direction ?? CardFundDirection.FUND).toLowerCase(),
    status: tx.status.toLowerCase(),
    createdAt: tx.createdAt.toISOString(),
  };
}

export async function handleGetCardFundBalance(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { exchangeRate } = await getFundConfigAsync();
    let wallet = null;
    try {
      wallet = await getWalletBalance(userId);
    } catch (e) {
      if (!(e instanceof WalletNotFoundError)) throw e;
    }

    const stripeResult = await getCardBalanceUsdForUser(user);

    res.json({
      wallet,
      card: {
        balanceUsd: stripeResult.balanceUsd,
        balanceGmdEstimate: stripeResult.balanceUsd * exchangeRate,
        balanceSource: stripeResult.balanceSource,
        exchangeRate,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load balances';
    res.status(500).json({ error: msg });
  }
}

export async function handleFundCard(req: DeviceAuthedRequest, res: Response): Promise<void> {
  try {
    const parsed = fundCardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const userId = req.userId!;
    const amountGmd = parsed.data.amountGmd;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user.kycComplete) {
      res.status(403).json({ error: 'KYC must be approved before funding your card.' });
      return;
    }
    if (user.stripeProvisioningStatus !== StripeProvisioningStatus.ACTIVE) {
      res.status(409).json({ error: 'Your virtual card is not ready yet.' });
      return;
    }

    const { exchangeRate } = await getFundConfigAsync();
    const { feeGmd, totalGmd } = await calculateCardFundFee(amountGmd);
    const amountUsd = amountGmd / exchangeRate;

    const before = await getCardBalanceUsdForUser(user);
    const gmdEstimateBefore = before.balanceUsd * exchangeRate;

    const cardFundId = crypto.randomUUID();

    let walletTx;
    try {
      walletTx = await debitWallet({
        userId,
        amountGmd: totalGmd,
        type: WalletTransactionType.CARD_FUND,
        deviceId: req.deviceId,
        referenceType: 'card_fund',
        referenceId: cardFundId,
        description:
          feeGmd > 0
            ? `Card funding (${amountGmd} GMD + ${feeGmd} GMD fee)`
            : 'Card funding',
        usdEstimate: amountUsd,
        exchangeRate,
      });
    } catch (e) {
      if (e instanceof InsufficientWalletBalanceError) {
        res.status(400).json({ error: 'Your vPay wallet does not have enough balance.' });
        return;
      }
      if (e instanceof WalletNotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      throw e;
    }

    const credit = await creditCardBalanceUsd(user, amountUsd);

    if (!credit.credited) {
      await creditWallet({
        userId,
        amountGmd: totalGmd,
        type: WalletTransactionType.ADJUSTMENT,
        deviceId: req.deviceId,
        referenceType: 'card_fund_reversal',
        referenceId: cardFundId,
        description: 'Card funding refund — could not credit your card',
      });

      await prisma.cardFundTransaction.create({
        data: {
          id: cardFundId,
          userId,
          deviceId: req.deviceId,
          walletTransactionId: walletTx.id,
          amountGmd,
          feeGmd,
          amountUsd,
          exchangeRate,
          stripeBalanceBeforeUsd: before.balanceUsd,
          stripeBalanceAfterUsd: before.balanceUsd,
          gmdEstimateBefore,
          gmdEstimateAfter: gmdEstimateBefore,
          stripeCredited: false,
          status: CardFundTransactionStatus.FAILED,
        },
      });

      res.status(502).json({
        error: 'Could not credit your card balance. Your wallet has been refunded.',
      });
      return;
    }

    const refreshedUser = await prisma.user.findUnique({ where: { id: userId } });
    const after = refreshedUser
      ? await getCardBalanceUsdForUser(refreshedUser)
      : before;
    const gmdEstimateAfter = after.balanceUsd * exchangeRate;

    const cardFundTx = await prisma.cardFundTransaction.create({
      data: {
        id: cardFundId,
        userId,
        deviceId: req.deviceId,
        walletTransactionId: walletTx.id,
        amountGmd,
        feeGmd,
        amountUsd,
        exchangeRate,
        stripeBalanceBeforeUsd: before.balanceUsd,
        stripeBalanceAfterUsd: after.balanceUsd,
        gmdEstimateBefore,
        gmdEstimateAfter,
        stripeCredited: credit.stripeCredited,
        status: CardFundTransactionStatus.COMPLETED,
      },
    });

    await postCardFundJournal({
      walletId: walletTx.walletId,
      walletTransactionId: walletTx.id,
      cardFundTransactionId: cardFundTx.id,
      amountGmd,
      feeGmd,
      metadata: { walletTransactionId: walletTx.id },
    });

    res.json({
      ok: true,
      transaction: toPublicCardFundTransaction(cardFundTx),
      card: {
        balanceUsd: after.balanceUsd,
        balanceGmdEstimate: gmdEstimateAfter,
        balanceSource: after.balanceSource,
      },
      wallet: await getWalletBalance(userId),
      stripeCredited: credit.stripeCredited,
      balanceSource: credit.balanceSource,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Card funding failed';
    console.error('[POST /api/card-fund]', msg);
    res.status(500).json({ error: msg });
  }
}

/** Reverse of card funding: debit card USD, credit vPay wallet GMD. */
export async function handleUnloadCard(req: DeviceAuthedRequest, res: Response): Promise<void> {
  try {
    const parsed = fundCardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const userId = req.userId!;
    const amountGmd = parsed.data.amountGmd;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user.kycComplete) {
      res.status(403).json({ error: 'KYC must be approved before withdrawing from your card.' });
      return;
    }
    if (user.stripeProvisioningStatus !== StripeProvisioningStatus.ACTIVE) {
      res.status(409).json({ error: 'Your virtual card is not ready yet.' });
      return;
    }

    const { exchangeRate } = await getFundConfigAsync();
    const amountUsd = amountGmd / exchangeRate;

    const result = await unloadCardBalanceToWallet({
      user,
      amountGmd,
      amountUsd,
      deviceId: req.deviceId,
    });

    const after = await getCardBalanceUsdForUser(user);

    res.json({
      ok: true,
      transaction: toPublicCardFundTransaction(result.transaction),
      card: {
        balanceUsd: after.balanceUsd,
        balanceGmdEstimate: after.balanceUsd * exchangeRate,
        balanceSource: after.balanceSource,
      },
      wallet: await getWalletBalance(userId),
    });
  } catch (e: unknown) {
    if (e instanceof CardUnloadError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Card withdrawal failed';
    console.error('[POST /api/card-fund/unload]', msg);
    res.status(500).json({ error: msg });
  }
}

export async function handleListCardFundTransactions(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId!;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = Math.min(
      Math.max(
        typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 20,
        1,
      ),
      100,
    );

    const rows = await prisma.cardFundTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const transactions = slice.map(toPublicCardFundTransaction);

    res.json({
      transactions,
      nextCursor: hasMore ? transactions[transactions.length - 1]?.id ?? null : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load card funding history';
    res.status(500).json({ error: msg });
  }
}
