import crypto from 'node:crypto';
import { StripeProvisioningStatus } from '@prisma/client';
import { WalletTransactionType } from '@prisma/client';

import { isVirtualCardActive } from '../card-expiry.js';
import { getCardIssuanceConfigAsync } from '../fund-config.js';
import { findUserById } from '../db.js';
import { prisma } from '../db.js';
import { log } from '../logger.js';
import { ensureLegacyProvisioningFields } from './mappers.js';
import { validateIssuingConfig } from './issuing-readiness.js';
import { provisionUserCard } from './provision.js';
import {
  debitWallet,
  ensureWalletForUser,
  InsufficientWalletBalanceError,
  WalletNotFoundError,
} from '../wallet/service.js';

export type AdminProvisionCardOptions = {
  /** When true, debit the user's vPay wallet for the issuance fee before provisioning. */
  chargeFee: boolean;
};

export type AdminProvisionCardResult = {
  charged: boolean;
  feeWaived: boolean;
  feeGmd: number;
  feeUsd: number;
  walletTransactionId: string | null;
  provisioning: {
    status: string;
    error: string | null;
  };
};

export class AdminProvisionCardError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AdminProvisionCardError';
  }
}

async function markIssuanceFeeWaived(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      cardIssuancePaidAt: new Date(),
      cardIssuanceFeeUsd: 0,
      cardIssuanceWalletTxId: null,
      stripeProvisioningStatus: StripeProvisioningStatus.PENDING,
      stripeProvisioningError: null,
    },
  });
}

async function chargeIssuanceFee(
  userId: string,
  isReissue: boolean,
): Promise<{ walletTransactionId: string | null; feeGmd: number; feeUsd: number }> {
  const config = await getCardIssuanceConfigAsync();

  if (!config.required) {
    await markIssuanceFeeWaived(userId);
    return { walletTransactionId: null, feeGmd: 0, feeUsd: 0 };
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AdminProvisionCardError('User not found', 404);
  }

  await ensureWalletForUser(user);

  const paymentId = crypto.randomUUID();

  let walletTx;
  try {
    walletTx = await debitWallet({
      userId,
      amountGmd: config.feeGmd,
      type: WalletTransactionType.CARD_ISSUANCE,
      referenceType: isReissue ? 'card_reissue' : 'admin_card_issuance',
      referenceId: paymentId,
      description: isReissue
        ? 'Virtual card reissue fee (admin)'
        : 'Virtual card issuance fee (admin)',
      usdEstimate: config.feeUsd,
      exchangeRate: config.exchangeRate,
    });
  } catch (e) {
    if (e instanceof InsufficientWalletBalanceError) {
      throw new AdminProvisionCardError(
        `User wallet needs at least ${config.feeGmd} GMD to charge the issuance fee.`,
        400,
      );
    }
    if (e instanceof WalletNotFoundError) {
      throw new AdminProvisionCardError(e.message, 404);
    }
    throw e;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      cardIssuancePaidAt: new Date(),
      cardIssuanceFeeUsd: config.feeUsd,
      cardIssuanceWalletTxId: walletTx.id,
      stripeProvisioningStatus: StripeProvisioningStatus.PENDING,
      stripeProvisioningError: null,
    },
  });

  log('Admin card issuance fee collected', {
    userId,
    feeUsd: config.feeUsd,
    feeGmd: config.feeGmd,
    walletTransactionId: walletTx.id,
  });

  return {
    walletTransactionId: walletTx.id,
    feeGmd: config.feeGmd,
    feeUsd: config.feeUsd,
  };
}

export async function adminProvisionUserCard(
  userId: string,
  options: AdminProvisionCardOptions,
): Promise<AdminProvisionCardResult> {
  let user = await findUserById(userId);
  if (!user) {
    throw new AdminProvisionCardError('User not found', 404);
  }

  if (!user.kycComplete) {
    throw new AdminProvisionCardError('User must be KYC-approved before card provisioning', 400);
  }

  user = await ensureLegacyProvisioningFields(user);

  const cards = await prisma.virtualCard.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const activeCard = cards.find((c) => isVirtualCardActive(c));
  const hasActiveCard = Boolean(activeCard);
  const latestCard = cards[0] ?? null;
  const isReissue = Boolean(latestCard && !hasActiveCard);

  if (hasActiveCard) {
    throw new AdminProvisionCardError(
      `User already has an active virtual card (•••• ${activeCard!.last4}). Freeze or wait for expiry before reissuing.`,
      409,
    );
  }

  if (user.stripeProvisioningStatus === StripeProvisioningStatus.PENDING) {
    throw new AdminProvisionCardError('Card provisioning is already in progress for this user.', 409);
  }

  const config = await getCardIssuanceConfigAsync();
  let charged = false;
  let feeWaived = false;
  let walletTransactionId: string | null = null;
  let feeGmd = 0;
  let feeUsd = 0;

  const issuingCheck = validateIssuingConfig();
  if (!issuingCheck.ok) {
    throw new AdminProvisionCardError(issuingCheck.error, 503);
  }

  const alreadyPaidForCurrentCycle =
    Boolean(user.cardIssuancePaidAt) && Boolean(user.cardIssuanceWalletTxId) && !isReissue;

  if (options.chargeFee) {
    if (alreadyPaidForCurrentCycle) {
      feeGmd = config.feeGmd;
      feeUsd = config.feeUsd;
      walletTransactionId = user.cardIssuanceWalletTxId;
    } else {
      const charge = await chargeIssuanceFee(userId, isReissue);
      charged = Boolean(charge.walletTransactionId);
      feeWaived = !config.required;
      walletTransactionId = charge.walletTransactionId;
      feeGmd = charge.feeGmd;
      feeUsd = charge.feeUsd;
    }
  } else {
    await markIssuanceFeeWaived(userId);
    feeWaived = true;
  }

  await provisionUserCard(userId, { skipIssuanceFeeCheck: true });

  const refreshed = await findUserById(userId);
  const status = refreshed?.stripeProvisioningStatus.toLowerCase() ?? 'none';

  return {
    charged,
    feeWaived,
    feeGmd,
    feeUsd,
    walletTransactionId,
    provisioning: {
      status,
      error: refreshed?.stripeProvisioningError ?? null,
    },
  };
}
