import { DirectPayProvisioningStatus, type User } from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import { getDirectPayPartnerConfig, provisionDirectPayTenant } from './partner.js';

export class DirectPayMerchantAlreadyProvisionedError extends Error {
  readonly holderEmail: string;

  constructor(holderEmail: string) {
    super(`directPay merchant already linked to ${holderEmail}`);
    this.name = 'DirectPayMerchantAlreadyProvisionedError';
    this.holderEmail = holderEmail;
  }
}

async function assertDirectPayMerchantAvailable(userId: string): Promise<void> {
  const existingMerchant = await prisma.user.findFirst({
    where: {
      directPayBusinessId: { not: null },
      id: { not: userId },
    },
    select: { email: true },
  });

  if (existingMerchant) {
    throw new DirectPayMerchantAlreadyProvisionedError(existingMerchant.email);
  }
}

function slugHint(userId: string, email: string): string {
  const local = (email || '').split('@')[0] || 'user';
  const safe = local.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 24);
  return `vpay-${safe || 'user'}-${userId.slice(0, 6)}`.toLowerCase();
}

function businessNameFromUser(user: User): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const fromEmail = (user.email || '').split('@')[0]?.trim() || '';
  const baseRaw = fullName || fromEmail || 'User';
  const base = baseRaw
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
  return `${base || 'User'}-vpay`;
}

function ownerNameFromUser(user: User): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email.split('@')[0] || 'User';
}

export async function provisionUserDirectPayMerchant(userId: string): Promise<void> {
  const { configured } = getDirectPayPartnerConfig();
  if (!configured) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        directPayProvisioningStatus: DirectPayProvisioningStatus.FAILED,
        directPayProvisioningError: 'directPay is not configured',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.kycComplete) {
    throw new Error('KYC must be approved before directPay provisioning');
  }

  if (user.directPayBusinessId) {
    await prisma.user.update({
      where: { id: userId },
      data: { directPayProvisioningStatus: DirectPayProvisioningStatus.ACTIVE },
    });
    return;
  }

  await assertDirectPayMerchantAvailable(userId);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        directPayProvisioningStatus: DirectPayProvisioningStatus.PENDING,
        directPayProvisioningError: null,
      },
    });

    const webhookBase = (process.env.VPAY_PUBLIC_API_URL || '').replace(/\/$/, '');
    const data = await provisionDirectPayTenant({
      externalUserId: user.id,
      ownerEmail: user.email,
      ownerName: ownerNameFromUser(user),
      businessName: businessNameFromUser(user),
      slug: slugHint(user.id, user.email),
      industry: 'fintech',
      webhookUrl: webhookBase ? `${webhookBase}/api/webhooks/directpay` : null,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        directPayBusinessId: data.businessId,
        directPaySlug: data.slug,
        directPayProvisioningStatus: DirectPayProvisioningStatus.ACTIVE,
        directPayProvisioningError: null,
      },
    });

    log('directPay merchant provisioning completed', {
      userId,
      businessId: data.businessId,
      idempotentReplay: data.idempotentReplay,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown directPay provisioning error';
    log('directPay merchant provisioning failed', { userId, error: message });

    await prisma.user.update({
      where: { id: userId },
      data: {
        directPayProvisioningStatus: DirectPayProvisioningStatus.FAILED,
        directPayProvisioningError: message,
      },
    });
  }
}

export function scheduleDirectPayProvisioning(userId: string): void {
  void provisionUserDirectPayMerchant(userId);
}
