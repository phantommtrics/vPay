import type { Response } from 'express';
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

export async function handleListSupportTickets(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const tickets = await listSupportTickets(req.userId!);
    res.json({
      configured: supportConfigured(),
      topics: SUPPORT_TOPICS,
      tickets,
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
