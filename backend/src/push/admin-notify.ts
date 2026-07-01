import type { User } from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import { adminAppOrigin, configureWebPush, isWebPushConfigured, webpush } from './config.js';

type PushPayload = {
  title: string;
  body: string;
  data?: {
    url?: string;
    userId?: string;
  };
};

type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function formatCustomerName(user: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

export async function upsertAdminPushSubscription(
  adminUserId: string,
  subscription: PushSubscriptionInput,
): Promise<void> {
  await prisma.adminPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: adminUserId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId: adminUserId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function removeAdminPushSubscription(
  adminUserId: string,
  endpoint: string,
): Promise<void> {
  await prisma.adminPushSubscription.deleteMany({
    where: { userId: adminUserId, endpoint },
  });
}

async function sendPushToSubscription(
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<void> {
  configureWebPush();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
  } catch (error) {
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      await prisma.adminPushSubscription.delete({ where: { id: subscription.id } });
      log('Removed expired admin push subscription', { subscriptionId: subscription.id });
      return;
    }

    throw error;
  }
}

export async function notifyAdminsKycSubmitted(
  submitter: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>,
): Promise<void> {
  if (!isWebPushConfigured()) {
    log('Skipping KYC push notification — web push is not configured');
    return;
  }

  const subscriptions = await prisma.adminPushSubscription.findMany({
    where: { user: { adminUser: true } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) {
    log('No admin push subscriptions registered for KYC notification', { userId: submitter.id });
    return;
  }

  const customerName = formatCustomerName(submitter);
  const payload: PushPayload = {
    title: 'New KYC submission',
    body: `${customerName} submitted identity verification for review.`,
    data: {
      url: `${adminAppOrigin()}/kyc`,
      userId: submitter.id,
    },
  };

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendPushToSubscription(subscription, payload)),
  );

  const failed = results.filter((result) => result.status === 'rejected').length;
  log('KYC push notifications sent', {
    userId: submitter.id,
    attempted: subscriptions.length,
    failed,
  });
}
