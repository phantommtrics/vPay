import { randomInt } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { signToken, verifyToken } from '../auth.js';
import {
  canEditKyc,
  createUser,
  deleteOtp,
  findUserByEmail,
  findUserById,
  getLatestOtp,
  saveOtp,
  toPublicUser,
  updateUserProfile,
} from '../db.js';
import { sendOtpEmail } from '../email.js';
import { log } from '../logger.js';
import { formatZodError } from '../zod-utils.js';
import { WalletPhoneConflictError } from '../wallet/service.js';
import { PhoneAlreadyInUseError } from '../phone.js';

const sendOtpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

const profileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(6).max(20).optional(),
  dateOfBirth: z.string().min(4).max(20).optional(),
  address: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
  countryCode: z.string().min(2).max(2).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  documentType: z.string().min(1).max(50).optional(),
});

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export type AuthedRequest = Request & { userId?: string };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export async function handleSendOtp(req: Request, res: Response): Promise<void> {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  log('OTP requested', { email });
  await saveOtp(email, code, expiresAt);

  try {
    await sendOtpEmail(email, code);
    log('OTP sent', { email });
    res.json({ ok: true, message: 'Verification code sent' });
  } catch (err) {
    log('OTP send failed', { email, error: err instanceof Error ? err.message : 'unknown' });
    res.status(500).json({ error: 'Failed to send verification email' });
  }
}

export async function handleVerifyOtp(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { email, code } = parsed.data;
  const otp = await getLatestOtp(email);

  if (!otp) {
    res.status(400).json({ error: 'No verification code found. Request a new one.' });
    return;
  }

  if (otp.expiresAt < new Date()) {
    await deleteOtp(email);
    res.status(400).json({ error: 'Code expired. Request a new one.' });
    return;
  }

  if (otp.code !== code) {
    res.status(400).json({ error: 'Incorrect code. Please try again.' });
    return;
  }

  await deleteOtp(email);

  let user = await findUserByEmail(email);
  if (!user) {
    user = await createUser(email);
    log('New user created', { userId: user.id, email });
  }

  const token = signToken({ sub: user.id, email: user.email });
  log('User signed in', { userId: user.id, email });

  res.json({
    token,
    user: toPublicUser(user),
  });
}

export async function handleMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = await findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: toPublicUser(user) });
}

export async function handleUpdateProfile(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const current = await findUserById(req.userId!);
    if (!current) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!canEditKyc(current)) {
      res.status(403).json({ error: 'Your details cannot be edited at this time' });
      return;
    }
    const user = await updateUserProfile(req.userId!, parsed.data);
    log('Profile patch saved', { userId: req.userId, fields: Object.keys(parsed.data) });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof PhoneAlreadyInUseError || err instanceof WalletPhoneConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(403).json({
      error: err instanceof Error ? err.message : 'Cannot update profile',
    });
  }
}
