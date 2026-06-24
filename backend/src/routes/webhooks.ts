import type { Request, Response } from 'express';
import { VirtualCardStatus } from '@prisma/client';

import { syncVirtualCardFromStripe } from '../db.js';
import { log } from '../logger.js';
import { getStripe } from '../stripe/client.js';
import { scheduleCardProvisioning } from '../stripe/provision.js';

function mapStripeCardStatus(status: string): VirtualCardStatus | undefined {
  switch (status) {
    case 'active':
      return VirtualCardStatus.ACTIVE;
    case 'inactive':
      return VirtualCardStatus.INACTIVE;
    case 'canceled':
      return VirtualCardStatus.CANCELED;
    default:
      return undefined;
  }
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.includes('...')) {
    res.status(503).json({ error: 'Webhook secret not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, signature, secret);
  } catch (err) {
    log('Stripe webhook signature verification failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'issuing_card.updated': {
        const card = event.data.object as {
          id: string;
          last4?: string;
          exp_month?: number;
          exp_year?: number;
          status?: string;
        };

        await syncVirtualCardFromStripe(card.id, {
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          status: card.status ? mapStripeCardStatus(card.status) : undefined,
        });
        break;
      }
      case 'account.updated': {
        const account = event.data.object as { id?: string; capabilities?: Record<string, string> };
        if (account.id) {
          log('Stripe account updated', { accountId: account.id, capabilities: account.capabilities });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    log('Stripe webhook handler error', {
      type: event.type,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  res.json({ received: true });
}

export { scheduleCardProvisioning };
