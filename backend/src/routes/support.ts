import type { Request, Response } from 'express';
import { z } from 'zod';

import { findUserById } from '../db.js';
import { log } from '../logger.js';
import {
  createSupportTicket,
  getSupportTicket,
  listSupportTickets,
  supportConfigured,
  TicketingError,
} from '../support/service.js';
import { SUPPORT_TOPICS } from '../support/topics.js';
import {
  createWhatsappSession,
  getPublicWhatsappConfig,
  getWhatsappIdentifySecret,
  identifySecretMatches,
  identifyWhatsappSender,
} from '../support/whatsapp.js';
import { formatZodError } from '../zod-utils.js';
import type { AuthedRequest } from './auth.js';

const createSchema = z.object({
  topic: z.enum(['account', 'cards', 'funding', 'kyc', 'transactions', 'other'], {
    errorMap: () => ({ message: 'Choose a topic' }),
  }),
  summary: z.string().trim().min(3, 'Subject is too short').max(160, 'Subject is too long'),
  message: z
    .string()
    .trim()
    .min(10, 'Please describe your request in a bit more detail')
    .max(4000, 'Message is too long'),
  kind: z.enum(['question', 'issue']).optional(),
});

function sendTicketingError(res: Response, error: unknown): boolean {
  if (error instanceof TicketingError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

async function whatsappConfigForUserId(userId: string) {
  const user = await findUserById(userId);
  return getPublicWhatsappConfig(user);
}

export async function handleListSupportTickets(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const [tickets, whatsapp] = await Promise.all([
      listSupportTickets(req.userId!),
      whatsappConfigForUserId(req.userId!),
    ]);
    res.json({
      configured: supportConfigured(),
      topics: SUPPORT_TOPICS,
      tickets,
      whatsapp,
    });
  } catch (error) {
    if (sendTicketingError(res, error)) return;
    log('List support tickets failed', {
      userId: req.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Could not load your tickets. Try again shortly.' });
  }
}

export async function handleGetWhatsappSupport(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const whatsapp = await whatsappConfigForUserId(req.userId!);
    res.json({ whatsapp });
  } catch (error) {
    log('Get WhatsApp support config failed', {
      userId: req.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Could not load WhatsApp support. Try again shortly.' });
  }
}

export async function handleCreateWhatsappSession(req: AuthedRequest, res: Response): Promise<void> {
  const user = await findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const session = createWhatsappSession(user);
  if (!session.enabled) {
    const error =
      session.unavailableReason === 'no_phone'
        ? 'Add your phone number in Profile to chat on WhatsApp.'
        : 'WhatsApp support is not available yet.';
    res.status(session.unavailableReason === 'no_phone' ? 400 : 503).json({ error });
    return;
  }

  res.status(201).json({
    whatsapp: {
      enabled: true,
      supportE164: session.supportE164,
      walletPhoneE164: session.walletPhoneE164,
      walletPhoneMasked: session.walletPhoneMasked,
      token: session.token,
      prefill: session.prefill,
    },
  });
}

function desklineIdentifyKey(req: Request): string | undefined {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.trim()) return apiKey;
  const deskline = req.headers['x-deskline-secret'];
  if (typeof deskline === 'string' && deskline.trim()) return deskline;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

const identifySchema = z.object({
  from: z.string().trim().min(6, 'from is required').max(32),
  token: z.string().trim().min(1).max(2000).optional(),
  text: z.string().trim().max(4096).optional(),
  message: z.string().trim().max(4096).optional(),
});

export async function handleWhatsappIdentify(req: Request, res: Response): Promise<void> {
  if (!getWhatsappIdentifySecret()) {
    res.status(503).json({ error: 'WhatsApp identify is not configured' });
    return;
  }
  if (!identifySecretMatches(desklineIdentifyKey(req))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = identifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const result = await identifyWhatsappSender({
      from: parsed.data.from,
      token: parsed.data.token,
      text: parsed.data.text || parsed.data.message,
    });
    res.json(result);
  } catch (error) {
    log('WhatsApp identify failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Could not identify this WhatsApp sender.' });
  }
}

export async function handleGetSupportTicket(req: AuthedRequest, res: Response): Promise<void> {
  const ticketId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!ticketId) {
    res.status(400).json({ error: 'Ticket is required' });
    return;
  }

  try {
    const ticket = await getSupportTicket(req.userId!, ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ ticket });
  } catch (error) {
    if (sendTicketingError(res, error)) return;
    log('Get support ticket failed', {
      userId: req.userId,
      ticketId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Could not load this ticket. Try again shortly.' });
  }
}

export async function handleCreateSupportTicket(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const user = await findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  try {
    const ticket = await createSupportTicket(user, {
      topic: parsed.data.topic,
      summary: parsed.data.summary,
      message: parsed.data.message,
      kind: parsed.data.kind ?? 'question',
    });
    res.status(201).json({ ticket });
  } catch (error) {
    if (sendTicketingError(res, error)) return;
    log('Create support ticket failed', {
      userId: req.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Could not send your request. Try again shortly.' });
  }
}
