import {
  EmailNotificationAudience,
  EmailNotificationStatus,
  EmailNotificationTemplate,
  type Prisma,
} from '@prisma/client';

import { prisma } from './db.js';
import { log } from './logger.js';

export type EmailLogInput = {
  recipientEmail: string;
  template: EmailNotificationTemplate;
  audience: EmailNotificationAudience;
  subject: string;
  body: string;
  status: EmailNotificationStatus;
  resendMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Prisma.InputJsonValue;
};

async function resolveRecipientUserId(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function logEmailNotification(input: EmailLogInput): Promise<void> {
  try {
    const recipientUserId = await resolveRecipientUserId(input.recipientEmail);
    await prisma.emailNotification.create({
      data: {
        recipientEmail: input.recipientEmail,
        recipientUserId,
        template: input.template,
        audience: input.audience,
        subject: input.subject,
        body: input.body,
        status: input.status,
        resendMessageId: input.resendMessageId ?? null,
        errorMessage: input.errorMessage ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (err) {
    log('Email notification log failed', {
      recipientEmail: input.recipientEmail,
      template: input.template,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
