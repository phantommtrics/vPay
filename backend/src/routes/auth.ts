import { AccountStatus } from '@prisma/client';
import { randomInt } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { prisma } from '../db.js';
import { signToken, verifyToken } from '../auth.js';
import {
  ACCOUNT_DELETE_CONFIRMATION,
  AccountTerminateError,
  terminateAccount,
} from '../account/terminate.js';
import {
  canEditKyc,
  createUser,
  deleteOtp,
  findActiveUserByEmail,
  findUserById,
  getLatestOtp,
  saveOtp,
  toPublicUser,
  toPublicUserSession,
  updateUserProfile,
} from '../db.js';
import { sendOtpEmail, sendWelcomeEmail } from '../email.js';
import {
  assertDeviceLoginAllowed,
  DeviceLoginError,
  recordMonthlyDeviceLogin,
} from '../device/limits.js';
import { formatDeviceForOtpEmail } from '../device/format.js';
import {
  deviceInfoSchema,
  getClientIp,
  registerOrUpdateUserDevice,
  resolveUserDeviceId,
} from '../device/service.js';
import { log } from '../logger.js';
import { formatZodError } from '../zod-utils.js';
import { WalletPhoneConflictError } from '../wallet/service.js';
import { PhoneAlreadyInUseError } from '../phone.js';

const sendOtpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  device: deviceInfoSchema.optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
  device: deviceInfoSchema.optional(),
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

const deviceLockSchema = z.object({
  enabled: z.boolean(),
  device: deviceInfoSchema.optional(),
});

const deleteAccountSchema = z.object({
  confirmation: z.string().min(1),
});

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export type AuthedRequest = Request & { userId?: string };

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = verifyToken(header.slice(7));
    const user = await findUserById(payload.sub);
    if (
      !user ||
      user.accountStatus === AccountStatus.TERMINATED ||
      user.accountStatus === AccountStatus.BLOCKED
    ) {
      res.status(401).json({
        error:
          user?.accountStatus === AccountStatus.BLOCKED
            ? 'This account has been blocked. Contact support.'
            : 'Invalid or expired session',
        ...(user?.accountStatus === AccountStatus.BLOCKED ? { code: 'ACCOUNT_BLOCKED' } : {}),
      });
      return;
    }
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
  const deviceInput = parsed.data.device;
  const existingUser = await findActiveUserByEmail(email);

  if (existingUser?.accountStatus === AccountStatus.BLOCKED) {
    res.status(403).json({
      error: 'This account has been blocked. Contact support.',
      code: 'ACCOUNT_BLOCKED',
    });
    return;
  }

  if (existingUser && deviceInput) {
    try {
      await assertDeviceLoginAllowed(existingUser, deviceInput);
    } catch (err) {
      if (err instanceof DeviceLoginError) {
        res.status(403).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  log('OTP requested', { email, hasDevice: Boolean(deviceInput) });
  await saveOtp(email, code, expiresAt);

  const isNewUser = !existingUser;
  const deviceSummary = deviceInput ? formatDeviceForOtpEmail(deviceInput) : undefined;

  try {
    await sendOtpEmail(email, code, {
      device: deviceSummary,
      accountDeviceLocked: existingUser?.deviceLockEnabled ?? false,
    });
    log('OTP sent', { email });

    if (isNewUser) {
      try {
        await sendWelcomeEmail(email);
        log('Welcome email sent', { email });
      } catch (err) {
        log('Welcome email failed', {
          email,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    res.json({
      ok: true,
      message: 'Verification code sent',
      accountDeviceLocked: existingUser?.deviceLockEnabled ?? false,
    });
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

  let user = await findActiveUserByEmail(email);
  if (user?.accountStatus === AccountStatus.BLOCKED) {
    res.status(403).json({
      error: 'This account has been blocked. Contact support.',
      code: 'ACCOUNT_BLOCKED',
    });
    return;
  }

  if (!user) {
    user = await createUser(email);
    log('New user created', { userId: user.id, email });
  }

  const token = signToken({ sub: user.id, email: user.email });

  let device = null;
  if (parsed.data.device) {
    try {
      await assertDeviceLoginAllowed(user, parsed.data.device);
      device = await registerOrUpdateUserDevice(
        user.id,
        parsed.data.device,
        getClientIp(req),
      );
      await recordMonthlyDeviceLogin(user.id, parsed.data.device);
    } catch (err) {
      if (err instanceof DeviceLoginError) {
        res.status(403).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  }

  log('User signed in', { userId: user.id, email, deviceId: device?.id ?? null });

  res.json({
    token,
    user: await toPublicUserSession(user, device?.id ?? null),
    device,
  });
}

export async function handleRegisterDevice(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = deviceInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const device = await registerOrUpdateUserDevice(
    req.userId!,
    parsed.data,
    getClientIp(req),
  );

  res.json({ device });
}

export async function handleUpdateDeviceLock(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = deviceLockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const userId = req.userId!;
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (parsed.data.enabled) {
    if (!parsed.data.device) {
      res.status(400).json({
        error: 'Device information is required to enable device lock.',
        code: 'DEVICE_REQUIRED',
      });
      return;
    }

    const device = await registerOrUpdateUserDevice(
      userId,
      parsed.data.device,
      getClientIp(req),
    );

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        deviceLockEnabled: true,
        lockedDeviceId: device.id,
      },
    });

    log('Device lock enabled', { userId, lockedDeviceId: device.id });

    res.json({
      user: await toPublicUserSession(updated, device.id),
      device,
    });
    return;
  }

  const headerDeviceId = req.headers['x-device-id'];
  const requestDeviceId =
    typeof headerDeviceId === 'string' ? headerDeviceId : undefined;
  const resolvedDeviceId = await resolveUserDeviceId(userId, requestDeviceId);

  if (
    user.deviceLockEnabled &&
    user.lockedDeviceId &&
    resolvedDeviceId &&
    resolvedDeviceId !== user.lockedDeviceId
  ) {
    res.status(403).json({
      error:
        'Device lock can only be turned off from your registered device. Open vPay on that device to disable this setting.',
      code: 'DEVICE_LOCK_VIOLATION',
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      deviceLockEnabled: false,
      lockedDeviceId: null,
    },
  });

  log('Device lock disabled', { userId });

  res.json({
    user: await toPublicUserSession(updated, resolvedDeviceId),
  });
}

export async function handleMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = await findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const headerDeviceId = req.headers['x-device-id'];
  const deviceId =
    typeof headerDeviceId === 'string'
      ? await resolveUserDeviceId(req.userId!, headerDeviceId)
      : null;

  res.json({ user: await toPublicUserSession(user, deviceId) });
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
    res.json({ user: await toPublicUser(user) });
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

export async function handleDeleteAccount(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`,
    });
    return;
  }

  try {
    await terminateAccount(req.userId!, parsed.data.confirmation);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof AccountTerminateError) {
      res.status(err.status).json({
        error: err.message,
        code: err.code,
        ...(err.details ?? {}),
      });
      return;
    }
    log('Account deletion failed', {
      userId: req.userId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    res.status(500).json({ error: 'Failed to delete account' });
  }
}
