import type { Response } from 'express';
import {
  DirectPayProvisioningStatus,
  KycStatus,
  StripeProvisioningStatus,
} from '@prisma/client';
import { z } from 'zod';

import {
  findUserByEmail,
  findUserById,
  getAdminStats,
  listAdminUsers,
  toAdminUser,
  toAdminUserSummary,
} from '../db.js';
import { listUserDevicesForAdmin, clearUserDeviceLock } from '../device/service.js';
import { log } from '../logger.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';

const listQuerySchema = z.object({
  kycStatus: z.enum(['incomplete', 'pending', 'approved', 'rejected']).optional(),
  search: z.string().optional(),
  stripeStatus: z.enum(['none', 'pending', 'active', 'failed']).optional(),
  directPayStatus: z.enum(['none', 'pending', 'active', 'failed']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function parseKycStatus(value: string): KycStatus {
  return value.toUpperCase() as KycStatus;
}

function parseStripeStatus(value: string): StripeProvisioningStatus {
  return value.toUpperCase() as StripeProvisioningStatus;
}

function parseDirectPayStatus(value: string): DirectPayProvisioningStatus {
  return value.toUpperCase() as DirectPayProvisioningStatus;
}

export async function handleAdminStats(_req: AdminAuthedRequest, res: Response): Promise<void> {
  const stats = await getAdminStats();
  res.json({ stats });
}

export async function handleListAdminUsers(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  const { users, total } = await listAdminUsers({
    kycStatus: parsed.data.kycStatus ? parseKycStatus(parsed.data.kycStatus) : undefined,
    search: parsed.data.search,
    stripeStatus: parsed.data.stripeStatus
      ? parseStripeStatus(parsed.data.stripeStatus)
      : undefined,
    directPayStatus: parsed.data.directPayStatus
      ? parseDirectPayStatus(parsed.data.directPayStatus)
      : undefined,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 25;

  res.json({
    users: users.map(toAdminUserSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function handleGetAdminUser(req: AdminAuthedRequest, res: Response): Promise<void> {
  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: await toAdminUser(user) });
}

export async function handleAdminUserDevices(req: AdminAuthedRequest, res: Response): Promise<void> {
  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const devices = await listUserDevicesForAdmin(userId);
  res.json({ devices });
}

export async function handleAdminUnlockUserDevice(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (!user.deviceLockEnabled) {
    res.status(400).json({ error: 'Device lock is not enabled for this customer.' });
    return;
  }

  await clearUserDeviceLock(userId);
  log('Admin cleared customer device lock', {
    adminUserId: req.adminUserId ?? null,
    customerUserId: userId,
    previousLockedDeviceId: user.lockedDeviceId,
  });

  const updated = await findUserById(userId);
  res.json({ user: updated ? await toAdminUser(updated) : null });
}

export async function handleLookupAdminUser(req: AdminAuthedRequest, res: Response): Promise<void> {
  const email = String(req.query.email ?? '')
    .toLowerCase()
    .trim();
  if (!email) {
    res.status(400).json({ error: 'email query parameter is required' });
    return;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: await toAdminUser(user) });
}
