import crypto from 'node:crypto';
import type { Response } from 'express';
import { StripeProvisioningStatus } from '@prisma/client';

import { isVirtualCardActive } from '../card-expiry.js';
import { prisma } from '../db.js';
import { getCardExpiryConfigAsync, getCardIssuanceConfigAsync } from '../fund-config.js';
import { log } from '../logger.js';
import { scheduleCardProvisioning } from '../stripe/provision.js';
import { validateIssuingConfig } from '../stripe/issuing-readiness.js';
import {
  debitWallet,
  ensureWalletForUser,
  getWalletBalance,
  InsufficientWalletBalanceError,
  refundCardIssuanceFee,
  WalletNotFoundError,
} from '../wallet/service.js';
import { WalletTransactionType } from '@prisma/client';
import type { AuthedRequest } from './auth.js';
import type { DeviceAuthedRequest } from '../middleware/device.js';

export async function handleGetCardIssuanceConfig(
  _req: AuthedRequest,
  res: Response,
): Promise<void> {
  const config = await getCardIssuanceConfigAsync();
  const expiryConfig = await getCardExpiryConfigAsync();
  res.json({
    feeUsd: config.feeUsd,
    feeGmd: config.feeGmd,
    exchangeRate: config.exchangeRate,
    required: config.required,
    expiryYears: expiryConfig.expiryYears,
  });
}

export async function handlePayCardIssuance(req: DeviceAuthedRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const config = await getCardIssuanceConfigAsync();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.kycComplete) {
      res.status(403).json({ error: 'Complete identity verification before requesting a card.' });
      return;
    }

    if (!user.cardTermsAcceptedAt) {
      res.status(403).json({ error: 'Accept card terms before requesting a card.' });
      return;
    }

    const latestCard = await prisma.virtualCard.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const hasActiveCard = latestCard ? isVirtualCardActive(latestCard) : false;
    const isReissue = Boolean(latestCard && !hasActiveCard);

    if (hasActiveCard) {
      res.status(409).json({ error: 'You already have a virtual card.' });
      return;
    }

    if (
      user.stripeProvisioningStatus === StripeProvisioningStatus.PENDING ||
      (user.stripeProvisioningStatus === StripeProvisioningStatus.ACTIVE && hasActiveCard)
    ) {
      res.status(409).json({
        error:
          user.stripeProvisioningStatus === StripeProvisioningStatus.PENDING
            ? 'Your card is already being issued.'
            : 'Your card is already active.',
      });
      return;
    }

    if (user.cardIssuancePaidAt && !isReissue) {
      if (user.stripeProvisioningStatus === StripeProvisioningStatus.FAILED) {
        scheduleCardProvisioning(userId);
      }
      res.json({
        ok: true,
        alreadyPaid: true,
        paidAt: user.cardIssuancePaidAt.toISOString(),
        provisioning: { status: user.stripeProvisioningStatus.toLowerCase() },
      });
      return;
    }

    if (!config.required) {
      const issuingCheck = validateIssuingConfig();
      if (!issuingCheck.ok) {
        res.status(503).json({ error: issuingCheck.error });
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          cardIssuancePaidAt: new Date(),
          cardIssuanceFeeUsd: 0,
          stripeProvisioningStatus: StripeProvisioningStatus.PENDING,
          stripeProvisioningError: null,
        },
      });
      scheduleCardProvisioning(userId);
      res.json({
        ok: true,
        feeWaived: true,
        reissue: isReissue,
        provisioning: { status: 'pending' },
      });
      return;
    }

    await ensureWalletForUser(user);

    const issuingCheck = validateIssuingConfig();
    if (!issuingCheck.ok) {
      res.status(503).json({ error: issuingCheck.error });
      return;
    }

    const paymentId = crypto.randomUUID();

    let walletTx;
    try {
      walletTx = await debitWallet({
        userId,
        amountGmd: config.feeGmd,
        type: WalletTransactionType.CARD_ISSUANCE,
        deviceId: req.deviceId,
        referenceType: isReissue ? 'card_reissue' : 'card_issuance',
        referenceId: paymentId,
        description: isReissue ? 'Virtual card reissue fee' : 'Virtual card issuance fee',
        usdEstimate: config.feeUsd,
        exchangeRate: config.exchangeRate,
      });
    } catch (e) {
      if (e instanceof InsufficientWalletBalanceError) {
        res.status(400).json({
          error: `Your wallet needs at least ${config.feeGmd} GMD to issue a card.`,
          feeGmd: config.feeGmd,
          feeUsd: config.feeUsd,
        });
        return;
      }
      if (e instanceof WalletNotFoundError) {
        res.status(404).json({ error: e.message });
        return;
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

    log(isReissue ? 'Card reissue fee collected' : 'Card issuance fee collected', {
      userId,
      feeUsd: config.feeUsd,
      feeGmd: config.feeGmd,
      walletTransactionId: walletTx.id,
    });

    scheduleCardProvisioning(userId);

    res.json({
      ok: true,
      feeUsd: config.feeUsd,
      feeGmd: config.feeGmd,
      paidAt: new Date().toISOString(),
      reissue: isReissue,
      wallet: await getWalletBalance(userId),
      provisioning: { status: 'pending' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Card issuance payment failed';
    log('Card issuance payment failed', { error: msg });
    res.status(500).json({ error: msg });
  }
}
