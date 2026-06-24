import type { User } from '@prisma/client';

import { prisma } from './db.js';
import { normalizePhoneE164, resolveCountryCode } from './stripe/mappers.js';

export class PhoneAlreadyInUseError extends Error {
  constructor() {
    super('This mobile number is already registered to another account');
    this.name = 'PhoneAlreadyInUseError';
  }
}

/** @deprecated Use PhoneAlreadyInUseError */
export class WalletPhoneConflictError extends PhoneAlreadyInUseError {}

export function normalizePhoneForUser(
  phone: string,
  countryCode: string | null | undefined,
): string {
  const code = countryCode?.trim() || 'gm';
  return normalizePhoneE164(phone.trim(), code);
}

export function resolveUserPhoneE164(user: Pick<User, 'phone' | 'phoneE164' | 'countryCode'>): string {
  if (user.phoneE164?.trim()) {
    return user.phoneE164.trim();
  }
  if (!user.phone?.trim()) {
    throw new Error('Phone number is required');
  }
  return normalizePhoneForUser(user.phone.trim(), resolveCountryCode(user as User));
}

export async function assertPhoneAvailable(userId: string, phoneE164: string): Promise<void> {
  const taken = await prisma.user.findFirst({
    where: {
      phoneE164,
      NOT: { id: userId },
    },
    select: { id: true },
  });

  if (taken) {
    throw new PhoneAlreadyInUseError();
  }
}
