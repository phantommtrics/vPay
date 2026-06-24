import type { Request, Response } from 'express';
import { z } from 'zod';

import { approveKyc, findUserById, rejectKyc, toPublicUser } from '../db.js';
import { provisionUserDirectPayMerchant } from '../directpay/provision.js';

const rejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || key !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function handleApproveKyc(req: Request, res: Response): Promise<void> {
  if (!requireAdmin(req, res)) return;

  const userId = String(req.params.userId);
  const user = await approveKyc(userId);
  res.json({ user: toPublicUser(user) });
}

export async function handleProvisionDirectPay(req: Request, res: Response): Promise<void> {
  if (!requireAdmin(req, res)) return;

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

  await provisionUserDirectPayMerchant(userId);
  const refreshed = await findUserById(userId);
  res.json({ user: refreshed ? toPublicUser(refreshed) : null });
}

export async function handleRejectKyc(req: Request, res: Response): Promise<void> {
  if (!requireAdmin(req, res)) return;

  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }

  const user = await rejectKyc(String(req.params.userId), parsed.data.reason);
  res.json({ user: toPublicUser(user) });
}
