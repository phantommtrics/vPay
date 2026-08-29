import { prisma } from '../db.js';
import { hashAppLockSecret, verifyAppLockSecret } from './crypto.js';
import { toDbAppLockType, type AppLockType } from './types.js';

export type { AppLockType };

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class AppLockError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppLockError';
  }
}

function remainingLockoutMs(lockedUntil: Date | null): number {
  if (!lockedUntil) return 0;
  return Math.max(0, lockedUntil.getTime() - Date.now());
}

function lockoutMessage(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export async function setUserAppLock(
  userId: string,
  type: AppLockType,
  secret: string,
  currentSecret?: string,
): Promise<AppLockType> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appLockType: true, appLockSecretHash: true },
  });

  if (user?.appLockType && user.appLockSecretHash) {
    if (!currentSecret) {
      throw new AppLockError('Enter your current PIN or password', 403, 'CURRENT_REQUIRED');
    }
    await verifyUserAppLock(userId, currentSecret);
  }

  const hash = await hashAppLockSecret(secret);
  await prisma.user.update({
    where: { id: userId },
    data: {
      appLockType: toDbAppLockType(type),
      appLockSecretHash: hash,
      appLockFailedAttempts: 0,
      appLockLockedUntil: null,
    },
  });
  return type;
}

export async function clearUserAppLock(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      appLockType: null,
      appLockSecretHash: null,
      appLockFailedAttempts: 0,
      appLockLockedUntil: null,
    },
  });
}

export async function verifyUserAppLock(userId: string, secret: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      appLockType: true,
      appLockSecretHash: true,
      appLockFailedAttempts: true,
      appLockLockedUntil: true,
    },
  });

  if (!user?.appLockType || !user.appLockSecretHash) {
    throw new AppLockError('No PIN or password is set', 400, 'NOT_SET');
  }

  const lockedMs = remainingLockoutMs(user.appLockLockedUntil);
  if (lockedMs > 0) {
    throw new AppLockError(lockoutMessage(lockedMs), 429, 'LOCKED');
  }

  const ok = await verifyAppLockSecret(secret, user.appLockSecretHash);
  if (ok) {
    if (user.appLockFailedAttempts > 0 || user.appLockLockedUntil) {
      await prisma.user.update({
        where: { id: userId },
        data: { appLockFailedAttempts: 0, appLockLockedUntil: null },
      });
    }
    return;
  }

  const attempts = user.appLockFailedAttempts + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
  await prisma.user.update({
    where: { id: userId },
    data: {
      appLockFailedAttempts: lockedUntil ? 0 : attempts,
      appLockLockedUntil: lockedUntil,
    },
  });

  if (lockedUntil) {
    throw new AppLockError(lockoutMessage(LOCKOUT_MS), 429, 'LOCKED');
  }

  throw new AppLockError('Incorrect PIN or password', 401, 'INVALID');
}
