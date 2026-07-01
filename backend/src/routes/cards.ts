import type { Response } from 'express';
import { VirtualCardStatus } from '@prisma/client';
import { z } from 'zod';

import { isVirtualCardActive } from '../card-expiry.js';
import {
  findUserById,
  findUserCard,
  findLatestUserCard,
  listUserCards,
  toPublicVirtualCard,
  updateVirtualCardStatus,
} from '../db.js';
import { log } from '../logger.js';
import { getCardExpiryConfigAsync, getCardIssuanceConfigAsync } from '../fund-config.js';
import { getStripePublishableKey } from '../stripe/client.js';
import { createEphemeralKey, updateCardStatus } from '../stripe/issuing.js';
import { sanitizeUserFacingText } from '../user-facing-text.js';
import { formatZodError } from '../zod-utils.js';
import type { AuthedRequest } from './auth.js';

const ephemeralKeySchema = z.object({
  nonce: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

async function requireKycApproved(userId: string, res: Response) {
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }

  if (!user.kycComplete) {
    res.status(403).json({ error: 'Complete identity verification to access cards' });
    return null;
  }

  return user;
}

export async function handleListCards(req: AuthedRequest, res: Response): Promise<void> {
  const user = await requireKycApproved(req.userId!, res);
  if (!user) return;

  const cards = await listUserCards(user.id);
  const publicCards = await Promise.all(cards.map((card) => toPublicVirtualCard(card, user)));
  const issuanceConfig = await getCardIssuanceConfigAsync();
  const expiryConfig = await getCardExpiryConfigAsync();
  const latestCard = await findLatestUserCard(user.id);
  const hasActiveCard = latestCard ? isVirtualCardActive(latestCard) : false;
  const canReissue = Boolean(latestCard && !hasActiveCard);

  res.json({
    cards: publicCards,
    provisioning: {
      status: user.stripeProvisioningStatus.toLowerCase(),
      error: sanitizeUserFacingText(user.stripeProvisioningError),
    },
    issuance: {
      feeUsd: issuanceConfig.feeUsd,
      feeGmd: issuanceConfig.feeGmd,
      exchangeRate: issuanceConfig.exchangeRate,
      required: issuanceConfig.required,
      expiryYears: expiryConfig.expiryYears,
      paid: Boolean(user.cardIssuancePaidAt) && !canReissue,
      paidAt: canReissue ? null : user.cardIssuancePaidAt?.toISOString() ?? null,
      canReissue,
    },
    stripePublishableKey: getStripePublishableKey(),
    stripeConnectedAccountId: user.stripeConnectedAccountId?.startsWith('platform:')
      ? null
      : user.stripeConnectedAccountId,
  });
}

export async function handleGetCard(req: AuthedRequest, res: Response): Promise<void> {
  const user = await requireKycApproved(req.userId!, res);
  if (!user) return;

  const card = await findUserCard(user.id, String(req.params.id));
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  res.json({ card: await toPublicVirtualCard(card, user) });
}

export async function handleCreateEphemeralKey(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const user = await requireKycApproved(req.userId!, res);
  if (!user) return;

  const parsed = ephemeralKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const card = await findUserCard(user.id, String(req.params.id));
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  if (!isVirtualCardActive(card)) {
    res.status(410).json({ error: 'This card has expired. Reissue a new card to continue.' });
    return;
  }

  try {
    const ephemeralKeySecret = await createEphemeralKey(
      card.stripeCardId,
      parsed.data.nonce,
      user.stripeConnectedAccountId,
    );

    res.json({
      ephemeralKeySecret,
      stripeCardId: card.stripeCardId,
      stripeConnectedAccountId: user.stripeConnectedAccountId?.startsWith('platform:')
        ? null
        : user.stripeConnectedAccountId,
      stripePublishableKey: getStripePublishableKey(),
    });
  } catch (err) {
    log('Ephemeral key creation failed', {
      userId: user.id,
      cardId: card.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
    res.status(500).json({ error: 'Failed to create ephemeral key' });
  }
}

export async function handleUpdateCardStatus(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const user = await requireKycApproved(req.userId!, res);
  if (!user) return;

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const card = await findUserCard(user.id, String(req.params.id));
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  if (!isVirtualCardActive(card)) {
    res.status(410).json({ error: 'This card has expired. Reissue a new card to continue.' });
    return;
  }

  try {
    await updateCardStatus(
      card.stripeCardId,
      user.stripeConnectedAccountId,
      parsed.data.status,
    );

    const dbStatus =
      parsed.data.status === 'inactive'
        ? VirtualCardStatus.INACTIVE
        : VirtualCardStatus.ACTIVE;

    const updated = await updateVirtualCardStatus(card.id, dbStatus);
    res.json({ card: await toPublicVirtualCard(updated, user) });
  } catch (err) {
    log('Card status update failed', {
      userId: user.id,
      cardId: card.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
    res.status(500).json({ error: 'Failed to update card status' });
  }
}
