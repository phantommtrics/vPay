import type { Response } from 'express';
import { z } from 'zod';

import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { getWebPushPublicKey, isWebPushConfigured } from '../push/config.js';
import {
  removeAdminPushSubscription,
  upsertAdminPushSubscription,
} from '../push/admin-notify.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export function handleAdminPushConfig(_req: AdminAuthedRequest, res: Response): void {
  if (!isWebPushConfigured()) {
    res.status(503).json({ error: 'Web push is not configured on the server' });
    return;
  }

  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: 'Web push public key is missing' });
    return;
  }

  res.json({ publicKey, enabled: true });
}

export async function handleAdminPushSubscribe(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  if (!isWebPushConfigured()) {
    res.status(503).json({ error: 'Web push is not configured on the server' });
    return;
  }

  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid subscription' });
    return;
  }

  if (!req.adminUserId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await upsertAdminPushSubscription(req.adminUserId, parsed.data);
  res.json({ ok: true });
}

export async function handleAdminPushUnsubscribe(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  if (!req.adminUserId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await removeAdminPushSubscription(req.adminUserId, parsed.data.endpoint);
  res.json({ ok: true });
}
