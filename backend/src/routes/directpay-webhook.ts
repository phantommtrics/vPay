import type { Request, Response } from 'express';
import crypto from 'node:crypto';

import { FundingOrderStatus } from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import {
  postCardFundJournal,
  postCardIssuanceFeeJournal,
  postWalletTopupJournal,
} from '../journal/service.js';
import { creditWalletFromFundingOrder } from '../wallet/service.js';

function verifyDirectPayPartnerWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  const got = (signatureHeader ?? '').trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

type PartnerWebhookPayload = {
  event?: string;
  partnerExternalBookingId?: string;
  paymentId?: string;
  data?: Record<string, unknown>;
};

function pickFundingId(body: PartnerWebhookPayload): string | undefined {
  const nested =
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>).partnerExternalBookingId
      : undefined;
  return (body.partnerExternalBookingId || nested) as string | undefined;
}

function pickPaymentId(body: PartnerWebhookPayload): string | undefined {
  const nested =
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>).paymentId
      : undefined;
  return (body.paymentId || nested) as string | undefined;
}

type FundingMetadata = {
  directPay?: {
    webhookDedupe?: string[];
    lastWebhookEvent?: string;
    lastPaymentId?: string;
  };
};

export async function handleDirectPayWebhook(req: Request, res: Response): Promise<void> {
  const secret = (process.env.INTERNAL_PARTNER_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.warn('[webhooks/directpay] INTERNAL_PARTNER_WEBHOOK_SECRET not set');
    res.status(503).json({ error: 'Webhook verifier not configured' });
    return;
  }

  const raw =
    typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : '';
  const sig = req.headers['x-easypay-signature'] as string | undefined;
  if (!verifyDirectPayPartnerWebhook(raw, sig, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let body: PartnerWebhookPayload = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const event = String(body.event || '');
  const fundingId = pickFundingId(body);
  const paymentId = pickPaymentId(body);

  try {
    if (!fundingId) {
      res.json({ ok: true, ignored: true });
      return;
    }

    const order = await prisma.fundingOrder.findUnique({ where: { id: fundingId } });
    if (!order) {
      log('directPay webhook: funding order not found', { fundingId, event });
      res.json({ ok: true, ignored: true });
      return;
    }

    const meta = (order.metadata && typeof order.metadata === 'object'
      ? order.metadata
      : {}) as FundingMetadata;
    const directPay = { ...(meta.directPay ?? {}) };
    const dedupeKey = paymentId ? `${paymentId}:${event}` : null;
    const seen: string[] = Array.isArray(directPay.webhookDedupe) ? directPay.webhookDedupe : [];
    if (dedupeKey && seen.includes(dedupeKey)) {
      res.json({ ok: true, duplicate: true });
      return;
    }
    if (dedupeKey) {
      directPay.webhookDedupe = [...seen, dedupeKey].slice(-50);
    }
    directPay.lastWebhookEvent = event;
    if (paymentId) directPay.lastPaymentId = paymentId;

    if (event === 'payment.completed') {
      const walletTx = await creditWalletFromFundingOrder(
        order.userId,
        fundingId,
        order.amountGmd,
      );

      await prisma.fundingOrder.update({
        where: { id: fundingId },
        data: {
          status: FundingOrderStatus.PAID,
          directPayPaymentId: paymentId ?? order.directPayPaymentId,
          paidAt: new Date(),
          metadata: {
            ...meta,
            directPay,
            walletCredited: true,
            walletTransactionId: walletTx.id,
          },
        },
      });

      await postWalletTopupJournal({
        fundingOrderId: fundingId,
        walletId: walletTx.walletId,
        walletTransactionId: walletTx.id,
        amountGmd: order.amountGmd,
        feeGmd: order.feeGmd,
        totalGmd: order.totalGmd,
        metadata: { walletTransactionId: walletTx.id, paymentId },
      });

      log('Funding order paid via directPay webhook', {
        fundingId,
        paymentId,
        walletTransactionId: walletTx.id,
      });
    } else if (event === 'payment.failed') {
      await prisma.fundingOrder.update({
        where: { id: fundingId },
        data: {
          status: FundingOrderStatus.FAILED,
          metadata: { ...meta, directPay },
        },
      });
    } else if (event === 'payment.cancelled') {
      await prisma.fundingOrder.update({
        where: { id: fundingId },
        data: {
          status: FundingOrderStatus.CANCELLED,
          metadata: { ...meta, directPay },
        },
      });
    }

    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Webhook handler error';
    console.error('[webhooks/directpay]', msg);
    res.status(500).json({ error: msg });
  }
}
