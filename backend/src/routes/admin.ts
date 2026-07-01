import type { Response } from 'express';
import { KycStatus } from '@prisma/client';
import { z } from 'zod';

import { approveKyc, findUserById, rejectKyc, toPublicUser } from '../db.js';
import { recordKycReviewAudit } from '../kyc/audit.js';
import {
  DirectPayMerchantAlreadyProvisionedError,
  provisionUserDirectPayMerchant,
} from '../directpay/provision.js';
import { log } from '../logger.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import {
  adminProvisionUserCard,
  AdminProvisionCardError,
} from '../stripe/admin-provision.js';

const rejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

const provisionCardSchema = z.object({
  charge: z.boolean().optional().default(false),
});

function adminActorId(req: AdminAuthedRequest): string | null {
  return req.adminUserId ?? null;
}

async function adminActor(req: AdminAuthedRequest) {
  const id = adminActorId(req);
  if (id) {
    const user = await findUserById(id);
    if (user) {
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }
  }
  return {
    id: null,
    email: req.adminEmail ?? 'api-key@system',
    firstName: null,
    lastName: null,
  };
}

export async function handleApproveKyc(req: AdminAuthedRequest, res: Response): Promise<void> {
  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.kycStatus === KycStatus.APPROVED && user.kycComplete) {
    res.json({ user: await toPublicUser(user), alreadyApproved: true });
    return;
  }

  if (user.kycStatus !== KycStatus.PENDING) {
    res.status(400).json({
      error: `Cannot approve — KYC status is "${user.kycStatus.toLowerCase()}". User must submit KYC first.`,
    });
    return;
  }

  const updated = await approveKyc(userId);
  const actor = await adminActor(req);
  await recordKycReviewAudit({
    customer: updated,
    admin: actor,
    action: 'APPROVED',
  });
  log('Admin KYC approved', { adminUserId: actor.id, userId });
  res.json({ user: await toPublicUser(updated) });
}

export async function handleProvisionDirectPay(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (!user.kycComplete) {
    res.status(400).json({ error: 'User must be KYC-approved before directPay provisioning' });
    return;
  }

  try {
    await provisionUserDirectPayMerchant(userId);
    const refreshed = await findUserById(userId);
    log('Admin directPay provisioned', { adminUserId: adminActorId(req), userId });
    res.json({ user: refreshed ? await toPublicUser(refreshed) : null });
  } catch (e) {
    if (e instanceof DirectPayMerchantAlreadyProvisionedError) {
      res.status(409).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'directPay provisioning failed';
    res.status(500).json({ error: msg });
  }
}

export async function handleProvisionCard(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = provisionCardSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  const userId = String(req.params.userId);

  try {
    const result = await adminProvisionUserCard(userId, {
      chargeFee: parsed.data.charge,
    });

    const user = await findUserById(userId);
    log('Admin card provisioned', {
      adminUserId: adminActorId(req),
      userId,
      charge: parsed.data.charge,
    });
    res.json({
      user: user ? await toPublicUser(user) : null,
      provision: result,
    });
  } catch (e) {
    if (e instanceof AdminProvisionCardError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Card provisioning failed';
    res.status(500).json({ error: msg });
  }
}

export async function handleRejectKyc(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.kycStatus !== KycStatus.PENDING) {
    res.status(400).json({
      error: `Cannot reject — KYC status is "${user.kycStatus.toLowerCase()}". Only pending submissions can be rejected.`,
    });
    return;
  }

  const updated = await rejectKyc(userId, parsed.data.reason);
  const actor = await adminActor(req);
  await recordKycReviewAudit({
    customer: updated,
    admin: actor,
    action: 'REJECTED',
    rejectionReason: parsed.data.reason,
  });
  log('Admin KYC rejected', { adminUserId: actor.id, userId });
  res.json({ user: await toPublicUser(updated) });
}
