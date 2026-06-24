import type { User } from '@prisma/client';

export type ParsedDob = {
  day: number;
  month: number;
  year: number;
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'the gambia': 'gm',
  gambia: 'gm',
  senegal: 'sn',
  nigeria: 'ng',
  ghana: 'gh',
  'united states': 'us',
  usa: 'us',
  mexico: 'mx',
  'united kingdom': 'gb',
  uk: 'gb',
};

export function resolveCountryCode(user: User): string {
  if (user.countryCode?.trim()) {
    return user.countryCode.trim().toLowerCase();
  }

  const country = user.country?.trim().toLowerCase();
  if (country && COUNTRY_NAME_TO_CODE[country]) {
    return COUNTRY_NAME_TO_CODE[country];
  }

  if (country && country.length === 2) {
    return country;
  }

  return 'gm';
}

/** Billing country for Stripe cardholders — UK/EU test programs often require local addresses. */
export function getCardholderBillingCountry(user: User): string {
  const override = process.env.STRIPE_TEST_CARDHOLDER_COUNTRY?.trim().toLowerCase();
  if (override && override.length === 2) {
    return override;
  }
  return resolveCountryCode(user);
}

export function parseDateOfBirth(value: string): ParsedDob {
  const trimmed = value.trim();

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return {
      day: Number(slashMatch[1]),
      month: Number(slashMatch[2]),
      year: Number(slashMatch[3]),
    };
  }

  const dashMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    return {
      year: Number(dashMatch[1]),
      month: Number(dashMatch[2]),
      day: Number(dashMatch[3]),
    };
  }

  throw new Error('Invalid date of birth format. Use DD/MM/YYYY.');
}

export function normalizePhoneE164(phone: string, countryCode: string): string {
  const digits = phone.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    return digits;
  }

  const local = digits.replace(/^0+/, '');

  const prefixes: Record<string, string> = {
    gm: '+220',
    sn: '+221',
    ng: '+234',
    gh: '+233',
    us: '+1',
    mx: '+52',
    gb: '+44',
  };

  const prefix = prefixes[countryCode.toLowerCase()] ?? '+220';
  return `${prefix}${local}`;
}

export function getCardholderName(user: User): string {
  const first = user.firstName?.trim() ?? '';
  const last = user.lastName?.trim() ?? '';
  const name = `${first} ${last}`.trim();
  if (!name) {
    throw new Error('First and last name are required for card provisioning');
  }
  return name;
}

export function assertProvisioningReady(user: User): void {
  const required: Record<string, string | null | undefined> = {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    city: user.city,
    country: user.country,
    postalCode: user.postalCode,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `User profile is incomplete for card provisioning (missing: ${missing.join(', ')})`,
    );
  }

  if (!user.cardTermsAcceptedAt) {
    throw new Error('Card terms must be accepted before provisioning');
  }
}

/** Backfill fields added after early KYC submissions (dev/admin use). */
export async function ensureLegacyProvisioningFields(user: User): Promise<User> {
  const data: {
    postalCode?: string;
    countryCode?: string;
    cardTermsAcceptedAt?: Date;
    cardTermsAcceptedIp?: string;
  } = {};

  if (!user.postalCode?.trim()) {
    data.postalCode = '00000';
  }

  if (!user.countryCode?.trim()) {
    data.countryCode = resolveCountryCode(user);
  }

  if (!user.cardTermsAcceptedAt) {
    data.cardTermsAcceptedAt = user.kycSubmittedAt ?? new Date();
    data.cardTermsAcceptedIp = user.cardTermsAcceptedIp ?? '127.0.0.1';
  }

  if (Object.keys(data).length === 0) {
    return user;
  }

  const { prisma } = await import('../db.js');
  return prisma.user.update({
    where: { id: user.id },
    data,
  });
}

export function getTermsAcceptanceUnix(user: User): number {
  if (!user.cardTermsAcceptedAt) {
    throw new Error('Card terms acceptance timestamp is missing');
  }
  return Math.floor(user.cardTermsAcceptedAt.getTime() / 1000);
}

export function getTermsAcceptanceIp(user: User): string {
  return user.cardTermsAcceptedIp?.trim() || '127.0.0.1';
}

export function buildBillingAddress(user: User) {
  const countryCode = getCardholderBillingCountry(user);

  return {
    line1: user.address!.trim(),
    city: user.city!.trim(),
    postal_code: user.postalCode!.trim(),
    country: countryCode.toUpperCase(),
    state: countryCode.toUpperCase() === 'US' ? 'CA' : undefined,
  };
}
