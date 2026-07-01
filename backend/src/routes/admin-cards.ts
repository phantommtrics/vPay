import type { Response } from 'express';
import { VirtualCardStatus } from '@prisma/client';
import { z } from 'zod';

import { findUserById, findUserCard, toAdminCardSummary, updateVirtualCardStatus } from '../db.js';
import { isVirtualCardActive } from '../card-expiry.js';
import { log } from '../logger.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { updateCardStatus } from '../stripe/issuing.js';

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export async function handleAdminUpdateCardStatus(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const userId = String(req.params.userId);
  const cardId = String(req.params.cardId);

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const card = await findUserCard(userId, cardId);
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  if (!isVirtualCardActive(card)) {
    res.status(410).json({ error: 'This card has expired and cannot be frozen or unfrozen.' });
    return;
  }

  try {
    await updateCardStatus(card.stripeCardId, user.stripeConnectedAccountId, parsed.data.status);

    const dbStatus =
      parsed.data.status === 'inactive'
        ? VirtualCardStatus.INACTIVE
        : VirtualCardStatus.ACTIVE;

    const updated = await updateVirtualCardStatus(card.id, dbStatus);

    log('Admin card status updated', {
      adminUserId: req.adminUserId,
      userId,
      cardId,
      status: parsed.data.status,
    });

    res.json({ card: toAdminCardSummary(updated) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update card status';
    res.status(500).json({ error: msg });
  }
}
