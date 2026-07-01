import { randomInt } from 'node:crypto';
import type { Response } from 'express';
import { AdminUserStatus } from '@prisma/client';
import { z } from 'zod';

import { toAdminAuthUser } from '../admin/auth-user.js';
import { adminPermissionInclude } from '../admin/permissions.js';
import { signAdminToken, signPreAuthToken } from '../auth.js';
import {
  deleteOtp,
  findUserByEmail,
  findUserById,
  getLatestOtp,
  prisma,
  saveOtp,
} from '../db.js';
import { sendOtpEmail } from '../email.js';
import { log } from '../logger.js';
import type { AdminAuthedRequest, PreAuthRequest } from '../middleware/admin-auth.js';
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  totpQrDataUrl,
  verifyTotpCode,
} from '../totp.js';
import { formatZodError } from '../zod-utils.js';

const sendOtpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

const totpCodeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

const setupTotpSchema = z.object({
  secret: z.string().min(16).max(128),
});

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

function toAdminProfile(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  adminUser: boolean;
  adminUserType: import('@prisma/client').AdminUserType | null;
  adminUserStatus: AdminUserStatus;
  adminTotpEnabledAt: Date | null;
  adminTotpSecret: string | null;
  permissions?: string[];
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    adminUser: user.adminUser,
    adminUserType: user.adminUserType,
    adminUserStatus: user.adminUserStatus,
    totpEnrolled: Boolean(user.adminTotpEnabledAt && user.adminTotpSecret),
    permissions: user.permissions ?? [],
  };
}

export async function handleAdminSendOtp(req: PreAuthRequest, res: Response): Promise<void> {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmail(email);

  if (!user?.adminUser) {
    res.status(403).json({ error: 'This email is not authorized for admin access' });
    return;
  }

  if (user.adminUserStatus === AdminUserStatus.DISABLED) {
    res.status(403).json({ error: 'Admin account is disabled' });
    return;
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  log('Admin OTP requested', { email });
  await saveOtp(email, code, expiresAt);

  try {
    await sendOtpEmail(email, code);
    log('Admin OTP sent', { email });
    res.json({ ok: true, message: 'Verification code sent' });
  } catch (err) {
    log('Admin OTP send failed', { email, error: err instanceof Error ? err.message : 'unknown' });
    res.status(500).json({ error: 'Failed to send verification email' });
  }
}

export async function handleAdminVerifyOtp(req: PreAuthRequest, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { email, code } = parsed.data;
  const user = await findUserByEmail(email);

  if (!user?.adminUser) {
    res.status(403).json({ error: 'This email is not authorized for admin access' });
    return;
  }

  if (user.adminUserStatus === AdminUserStatus.DISABLED) {
    res.status(403).json({ error: 'Admin account is disabled' });
    return;
  }

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

  const preAuthToken = signPreAuthToken({ sub: user.id, email: user.email });
  const totpEnrolled = Boolean(user.adminTotpEnabledAt && user.adminTotpSecret);

  const userWithPerms = await prisma.user.findUnique({
    where: { id: user.id },
    include: adminPermissionInclude,
  });
  const authUser = userWithPerms ? toAdminAuthUser(userWithPerms) : null;

  log('Admin email OTP verified', { userId: user.id, email });

  res.json({
    preAuthToken,
    totpRequired: true,
    totpEnrolled,
    admin: authUser
      ? toAdminProfile({ ...authUser, adminTotpSecret: user.adminTotpSecret, adminTotpEnabledAt: user.adminTotpEnabledAt, permissions: authUser.permissions })
      : toAdminProfile(user),
  });
}

export async function handleAdminSetupTotp(req: PreAuthRequest, res: Response): Promise<void> {
  const userId = req.preAuthUserId!;
  const email = req.preAuthEmail!;

  const user = await findUserById(userId);
  if (!user?.adminUser) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (user.adminTotpEnabledAt && user.adminTotpSecret) {
    res.status(400).json({ error: 'Authenticator is already enrolled' });
    return;
  }

  const secret = generateTotpSecret();
  const uri = buildTotpUri(email, secret);
  const qrDataUrl = await totpQrDataUrl(uri);

  res.json({
    secret,
    qrDataUrl,
    manualEntryKey: secret,
    issuer: process.env.ADMIN_TOTP_ISSUER ?? 'vPay Admin',
  });
}

export async function handleAdminConfirmTotp(req: PreAuthRequest, res: Response): Promise<void> {
  const parsedBody = totpCodeSchema.safeParse(req.body);
  const parsedSecret = setupTotpSchema.safeParse({ secret: req.body?.secret });
  if (!parsedBody.success) {
    res.status(400).json({ error: formatZodError(parsedBody.error) });
    return;
  }
  if (!parsedSecret.success) {
    res.status(400).json({ error: 'Invalid authenticator setup' });
    return;
  }

  const userId = req.preAuthUserId!;
  const email = req.preAuthEmail!;
  const user = await findUserById(userId);

  if (!user?.adminUser) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (user.adminTotpEnabledAt && user.adminTotpSecret) {
    res.status(400).json({ error: 'Authenticator is already enrolled' });
    return;
  }

  const { secret } = parsedSecret.data;
  const { code } = parsedBody.data;

  if (!verifyTotpCode(secret, code)) {
    res.status(400).json({ error: 'Invalid authenticator code. Try again.' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      adminTotpSecret: encryptTotpSecret(secret),
      adminTotpEnabledAt: new Date(),
    },
    include: adminPermissionInclude,
  });

  const token = signAdminToken({ sub: updated.id, email: updated.email });
  const authUser = toAdminAuthUser(updated);
  log('Admin TOTP enrolled', { userId });

  res.json({
    token,
    admin: toAdminProfile({
      ...authUser,
      adminTotpSecret: updated.adminTotpSecret,
      adminTotpEnabledAt: updated.adminTotpEnabledAt,
      permissions: authUser.permissions,
    }),
  });
}

export async function handleAdminVerifyTotp(req: PreAuthRequest, res: Response): Promise<void> {
  const parsed = totpCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const userId = req.preAuthUserId!;
  const user = await findUserById(userId);

  if (!user?.adminUser) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (!user.adminTotpSecret || !user.adminTotpEnabledAt) {
    res.status(400).json({ error: 'Authenticator not enrolled. Complete setup first.' });
    return;
  }

  const secret = decryptTotpSecret(user.adminTotpSecret);
  if (!verifyTotpCode(secret, parsed.data.code)) {
    res.status(400).json({ error: 'Invalid authenticator code. Try again.' });
    return;
  }

  const token = signAdminToken({ sub: user.id, email: user.email });
  const userWithPerms = await prisma.user.findUnique({
    where: { id: user.id },
    include: adminPermissionInclude,
  });
  const authUser = userWithPerms ? toAdminAuthUser(userWithPerms) : null;
  log('Admin TOTP verified', { userId });

  res.json({
    token,
    admin: authUser
      ? toAdminProfile({
          ...authUser,
          adminTotpSecret: user.adminTotpSecret,
          adminTotpEnabledAt: user.adminTotpEnabledAt,
          permissions: authUser.permissions,
        })
      : toAdminProfile(user),
  });
}

export async function handleAdminMe(req: AdminAuthedRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.adminUserId! },
    include: adminPermissionInclude,
  });

  if (!user?.adminUser) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const authUser = toAdminAuthUser(user);
  res.json({
    admin: toAdminProfile({
      ...authUser,
      adminTotpSecret: user.adminTotpSecret,
      adminTotpEnabledAt: user.adminTotpEnabledAt,
      permissions: authUser.permissions,
    }),
  });
}
