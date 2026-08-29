import type { User } from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import {
  createTicketingTicket,
  getTicketingConfig,
  getTicketingTicket,
  TicketingError,
} from '../ticketing/client.js';
import {
  isSupportTopic,
  topicLabel,
  type SupportKind,
  type SupportTopicKey,
} from './topics.js';

export { TicketingError };

export type PublicSupportComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type PublicSupportTicket = {
  id: string;
  ref: string;
  topic: SupportTopicKey;
  summary: string;
  message: string;
  kind: SupportKind;
  status: string;
  createdAt: string;
  comments: PublicSupportComment[];
};

export function supportConfigured(): boolean {
  return getTicketingConfig().configured;
}

function toPublic(
  row: {
    id: string;
    ticketingRef: string;
    topic: string;
    summary: string;
    message: string;
    kind: string;
    status: string;
    createdAt: Date;
  },
  comments: PublicSupportComment[] = [],
): PublicSupportTicket {
  return {
    id: row.id,
    ref: row.ticketingRef,
    topic: isSupportTopic(row.topic) ? row.topic : 'other',
    summary: row.summary,
    message: row.message,
    kind: row.kind === 'issue' ? 'issue' : 'question',
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    comments,
  };
}

function customerName(user: User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

function buildDescription(user: User, message: string): string {
  const lines = [
    'Customer',
    `Name: ${customerName(user)}`,
    `Email: ${user.email}`,
    `Phone: ${user.phone?.trim() || '—'}`,
    `Account ID: ${user.id}`,
    `KYC: ${user.kycStatus.toLowerCase()}`,
    '',
    'Message',
    message.trim(),
  ];
  return lines.join('\n');
}

function buildSummary(topic: SupportTopicKey, summary: string): string {
  return `[${topicLabel(topic)}] ${summary.trim()}`.slice(0, 200);
}

export async function listSupportTickets(userId: string): Promise<PublicSupportTicket[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (!rows.length || !supportConfigured()) {
    return rows.map(toPublic);
  }

  try {
    const refreshed = await Promise.all(
      rows.map(async (row) => {
        const live = await getTicketingTicket(row.ticketingId);
        if (!live || live.status === row.status) return row;
        return prisma.supportTicket.update({
          where: { id: row.id },
          data: { status: live.status },
        });
      }),
    );
    return refreshed.map(toPublic);
  } catch (error) {
    log('Support ticket status refresh failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return rows.map(toPublic);
  }
}

export async function createSupportTicket(
  user: User,
  input: { topic: SupportTopicKey; summary: string; message: string; kind: SupportKind },
): Promise<PublicSupportTicket> {
  const summary = buildSummary(input.topic, input.summary);
  const created = await createTicketingTicket({
    summary,
    description: buildDescription(user, input.message),
    type: input.kind === 'issue' ? 'INCIDENT' : 'REQUEST',
    priority: input.kind === 'issue' ? 'HIGH' : 'MEDIUM',
  });

  const row = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      ticketingId: created.id,
      ticketingRef: created.ref,
      topic: input.topic,
      summary: input.summary.trim(),
      message: input.message.trim(),
      kind: input.kind,
      status: created.status,
    },
  });

  log('Support ticket created', {
    userId: user.id,
    ticketId: row.id,
    ticketingRef: created.ref,
    topic: input.topic,
  });

  return toPublic(row);
}

export async function getSupportTicket(
  userId: string,
  ticketId: string,
): Promise<PublicSupportTicket | null> {
  const row = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!row) return null;

  if (!supportConfigured()) {
    return toPublic(row);
  }

  try {
    const live = await getTicketingTicket(row.ticketingId);
    const comments = live?.comments ?? [];
    if (!live || live.status === row.status) {
      return toPublic(row, comments);
    }
    const updated = await prisma.supportTicket.update({
      where: { id: row.id },
      data: { status: live.status },
    });
    return toPublic(updated, comments);
  } catch (error) {
    log('Support ticket detail refresh failed', {
      userId,
      ticketId,
      error: error instanceof Error ? error.message : String(error),
    });
    return toPublic(row);
  }
}
