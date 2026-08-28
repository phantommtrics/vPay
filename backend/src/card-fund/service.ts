import crypto from 'node:crypto';
import {
  CardFundDirection,
  CardFundTransactionStatus,
  WalletTransactionType,
  type CardFundTransaction,
  type User,
} from '@prisma/client';

import { prisma } from '../db.js';
import { getFundConfigAsync } from '../fund-config.js';
import { postCardUnloadJournal } from '../journal/service.js';
import { log } from '../logger.js';
import {
  creditCardBalanceUsd,
  debitCardBalanceUsd,
  getCardBalanceUsdForUser,
  InsufficientCardBalanceError,
} from '../stripe/card-balance.js';
import {
  creditWallet,
  debitWallet,
  getWalletBalance,
  WalletNotFoundError,
} from '../wallet/service.js';

export class CardUnloadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CardUnloadError';
  }
}

export type UnloadResult = {
  transaction: CardFundTransaction;
  amountGmd: number;
  amountUsd: number;
};

export async function unloadCardBalanceToWallet(params: {
  user: User;
  amountGmd: number;
  amountUsd: number;
  deviceId?: string | null;
  description?: string;
  referenceType?: string;
}): Promise<UnloadResult> {
  const { user, amountGmd, amountUsd } = params;
  const amountCents = Math.round(amountUsd * 100);
  if (amountGmd <= 0 || amountCents < 1) {
    throw new CardUnloadError(400, 'Amount is too small to withdraw.');
  }

  try {
    await getWalletBalance(user.id);
  } catch (e) {
    if (e instanceof WalletNotFoundError) {
      throw new CardUnloadError(404, e.message);
    }
    throw e;
  }

  const { exchangeRate } = await getFundConfigAsync();
  const before = await getCardBalanceUsdForUser(user);
  const gmdEstimateBefore = before.balanceUsd * exchangeRate;
  if (Math.round(before.balanceUsd * 100) < amountCents) {
    throw new CardUnloadError(400, 'Your card does not have enough balance.');
  }

  const unloadId = crypto.randomUUID();

  let debit;
  try {
    debit = await debitCardBalanceUsd(user, amountUsd);
  } catch (e) {
    if (e instanceof InsufficientCardBalanceError) {
      throw new CardUnloadError(400, 'Your card does not have enough balance.');
    }
    throw e;
  }

  if (!debit.debited) {
    throw new CardUnloadError(502, 'Could not withdraw from your card. Please try again.');
  }

  let walletTx;
  try {
    walletTx = await creditWallet({
      userId: user.id,
      amountGmd,
      type: WalletTransactionType.CARD_UNLOAD,
      deviceId: params.deviceId,
      referenceType: params.referenceType ?? 'card_unload',
      referenceId: unloadId,
      description: params.description ?? 'Card withdrawal to wallet',
      usdEstimate: amountUsd,
      exchangeRate,
    });
  } catch (e) {
    await creditCardBalanceUsd(user, amountUsd);
    if (e instanceof WalletNotFoundError) {
      throw new CardUnloadError(404, e.message);
    }
    throw e;
  }

  const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
  const after = refreshedUser ? await getCardBalanceUsdForUser(refreshedUser) : before;
  const gmdEstimateAfter = after.balanceUsd * exchangeRate;

  const transaction = await prisma.cardFundTransaction.create({
    data: {
      id: unloadId,
      userId: user.id,
      deviceId: params.deviceId ?? null,
      walletTransactionId: walletTx.id,
      amountGmd,
      feeGmd: 0,
      amountUsd,
      exchangeRate,
      stripeBalanceBeforeUsd: before.balanceUsd,
      stripeBalanceAfterUsd: after.balanceUsd,
      gmdEstimateBefore,
      gmdEstimateAfter,
      stripeCredited: debit.stripeDebited,
      direction: CardFundDirection.UNLOAD,
      status: CardFundTransactionStatus.COMPLETED,
    },
  });

  await postCardUnloadJournal({
    walletId: walletTx.walletId,
    walletTransactionId: walletTx.id,
    cardFundTransactionId: transaction.id,
    amountGmd,
    metadata: { walletTransactionId: walletTx.id },
  });

  return { transaction, amountGmd, amountUsd };
}

export async function restoreUnloadedCardBalance(params: {
  user: User;
  amountGmd: number;
  amountUsd: number;
  deviceId?: string | null;
  unloadTransactionId: string;
}): Promise<boolean> {
  const credit = await creditCardBalanceUsd(params.user, params.amountUsd);
  if (!credit.credited) {
    log('Card delete rollback: could not restore card balance', {
      userId: params.user.id,
      amountUsd: params.amountUsd,
      unloadTransactionId: params.unloadTransactionId,
    });
    return false;
  }

  try {
    await debitWallet({
      userId: params.user.id,
      amountGmd: params.amountGmd,
      type: WalletTransactionType.ADJUSTMENT,
      deviceId: params.deviceId,
      referenceType: 'card_delete_reversal',
      referenceId: params.unloadTransactionId,
      description: 'Card deletion refund — card was not canceled',
      usdEstimate: params.amountUsd,
    });
  } catch (e) {
    log('Card delete rollback: card restored but wallet debit failed', {
      userId: params.user.id,
      amountGmd: params.amountGmd,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return true;
}
