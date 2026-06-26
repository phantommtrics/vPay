import {
  DirectPayProvisioningStatus,
  KycStatus,
  PrismaClient,
  StripeProvisioningStatus,
  VirtualCardStatus,
  type User,
  type VirtualCard,
} from '@prisma/client';

import { log, logMissingPersonalDetails } from './logger.js';
import { getFundConfig } from './fund-config.js';
import {
  assertPhoneAvailable,
  normalizePhoneForUser,
  PhoneAlreadyInUseError,
} from './phone.js';
import { getFinancialAccountBalanceUsd } from './stripe/issuing.js';
import { getCardholderName } from './stripe/mappers.js';
import { resolveCardBalanceUsd } from './stripe/card-balance.js';
import { ensureWalletForUser } from './wallet/service.js';

export const prisma = new PrismaClient();

export type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
  kycStatus: 'incomplete' | 'pending' | 'approved' | 'rejected';
  kycComplete: boolean;
  documentType: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  kycSubmittedAt: string | null;
  kycRejectionReason: string | null;
  cardTermsAcceptedAt: string | null;
  stripeProvisioningStatus: 'none' | 'pending' | 'active' | 'failed';
  stripeProvisioningError: string | null;
  stripeConnectedAccountId: string | null;
  directPayProvisioningStatus: 'none' | 'pending' | 'active' | 'failed';
  directPayProvisioningError: string | null;
  directPayBusinessId: string | null;
};

export type PublicVirtualCard = {
  id: string;
  stripeCardId: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: 'active' | 'inactive' | 'canceled';
  balance: number;
  balanceUsd: number;
  balanceGmdEstimate: number;
  balanceSource: 'stripe' | 'simulated' | 'unavailable';
  currency: string;
  cardholderName: string;
};

function toKycStatus(status: KycStatus): PublicUser['kycStatus'] {
  return status.toLowerCase() as PublicUser['kycStatus'];
}

function toProvisioningStatus(
  status: StripeProvisioningStatus,
): PublicUser['stripeProvisioningStatus'] {
  return status.toLowerCase() as PublicUser['stripeProvisioningStatus'];
}

function toCardStatus(status: VirtualCardStatus): PublicVirtualCard['status'] {
  return status.toLowerCase() as PublicVirtualCard['status'];
}

function toDirectPayProvisioningStatus(
  status: DirectPayProvisioningStatus,
): PublicUser['directPayProvisioningStatus'] {
  return status.toLowerCase() as PublicUser['directPayProvisioningStatus'];
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    city: user.city,
    country: user.country,
    countryCode: user.countryCode,
    postalCode: user.postalCode,
    kycStatus: toKycStatus(user.kycStatus),
    kycComplete: user.kycComplete,
    documentType: user.documentType,
    documentFrontUrl: user.documentFrontUrl,
    documentBackUrl: user.documentBackUrl,
    kycSubmittedAt: user.kycSubmittedAt?.toISOString() ?? null,
    kycRejectionReason: user.kycRejectionReason,
    cardTermsAcceptedAt: user.cardTermsAcceptedAt?.toISOString() ?? null,
    stripeProvisioningStatus: toProvisioningStatus(user.stripeProvisioningStatus),
    stripeProvisioningError: user.stripeProvisioningError,
    stripeConnectedAccountId: user.stripeConnectedAccountId,
    directPayProvisioningStatus: toDirectPayProvisioningStatus(user.directPayProvisioningStatus),
    directPayProvisioningError: user.directPayProvisioningError,
    directPayBusinessId: user.directPayBusinessId,
  };
}

export async function toPublicVirtualCard(
  card: VirtualCard,
  user: User,
): Promise<PublicVirtualCard> {
  const { exchangeRate } = getFundConfig();
  const stripeResult = await getFinancialAccountBalanceUsd(
    user.stripeFinancialAccountId,
    user.stripeConnectedAccountId,
  );
  const { balanceUsd, balanceSource } = resolveCardBalanceUsd(
    stripeResult.balanceUsd,
    user.simulatedBalanceUsd,
  );
  const balanceGmdEstimate = balanceUsd * exchangeRate;

  let cardholderName = '';
  try {
    cardholderName = getCardholderName(user);
  } catch {
    cardholderName = '';
  }

  return {
    id: card.id,
    stripeCardId: card.stripeCardId,
    last4: card.last4,
    brand: card.brand,
    expMonth: card.expMonth,
    expYear: card.expYear,
    status: toCardStatus(card.status),
    balance: balanceUsd,
    balanceUsd,
    balanceGmdEstimate,
    balanceSource,
    currency: card.currency,
    cardholderName,
  };
}

export function canEditKyc(user: User): boolean {
  return user.kycStatus === KycStatus.INCOMPLETE || user.kycStatus === KycStatus.REJECTED;
}

function hasPersonalDetails(fields: {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode?: string | null;
}): boolean {
  return Object.values(fields).every(
    (val) => typeof val === 'string' && val.trim().length > 0,
  );
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(email: string): Promise<User> {
  return prisma.user.create({
    data: { email: email.toLowerCase() },
  });
}

export async function saveOtp(email: string, code: string, expiresAt: Date): Promise<void> {
  const normalized = email.toLowerCase();

  await prisma.$transaction([
    prisma.otpCode.deleteMany({ where: { email: normalized } }),
    prisma.otpCode.create({
      data: {
        email: normalized,
        code,
        expiresAt,
      },
    }),
  ]);
}

export async function getLatestOtp(
  email: string,
): Promise<{ code: string; expiresAt: Date } | null> {
  return prisma.otpCode.findFirst({
    where: { email: email.toLowerCase() },
    orderBy: { createdAt: 'desc' },
    select: { code: true, expiresAt: true },
  });
}

export async function deleteOtp(email: string): Promise<void> {
  await prisma.otpCode.deleteMany({ where: { email: email.toLowerCase() } });
}

export async function updateUserProfile(
  id: string,
  fields: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    country?: string;
    countryCode?: string;
    postalCode?: string;
    documentType?: string;
    documentFrontUrl?: string;
    documentBackUrl?: string | null;
    cardTermsAcceptedAt?: Date;
    cardTermsAcceptedIp?: string;
  },
): Promise<User> {
  const current = await findUserById(id);
  if (!current) {
    throw new Error('User not found');
  }

  if (!canEditKyc(current)) {
    throw new Error('Your verification cannot be edited at this time');
  }

  log('Profile updated', { userId: id, fields: Object.keys(fields) });

  const data: typeof fields & { phoneE164?: string | null } = { ...fields };

  if (fields.phone !== undefined) {
    const trimmed = fields.phone.trim();
    if (!trimmed) {
      throw new Error('Phone number is required');
    }
    const countryCode = fields.countryCode ?? current.countryCode;
    const phoneE164 = normalizePhoneForUser(trimmed, countryCode);
    await assertPhoneAvailable(id, phoneE164);
    data.phone = trimmed;
    data.phoneE164 = phoneE164;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
  });

  if (data.phoneE164) {
    try {
      await ensureWalletForUser(updated);
    } catch (e) {
      if (e instanceof PhoneAlreadyInUseError) {
        throw e;
      }
      log('Wallet ensure failed after profile update', {
        userId: id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return updated;
}

export async function acceptCardTerms(id: string, ip: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      cardTermsAcceptedAt: new Date(),
      cardTermsAcceptedIp: ip,
    },
  });
}

export type KycSubmitPayload = {
  documentType: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  countryCode?: string;
  postalCode: string;
  acceptCardTerms: boolean;
};

export async function submitKycForReview(
  id: string,
  payload: KycSubmitPayload,
): Promise<User> {
  const current = await findUserById(id);
  if (!current) {
    throw new Error('User not found');
  }

  if (!canEditKyc(current)) {
    throw new Error('Your verification has already been submitted');
  }

  if (!current.documentFrontUrl) {
    throw new Error('Front of document is required');
  }

  if (!payload.acceptCardTerms) {
    throw new Error('You must accept the card terms to continue');
  }

  const merged = {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    phone: payload.phone.trim(),
    dateOfBirth: payload.dateOfBirth.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    country: payload.country.trim(),
    postalCode: payload.postalCode.trim(),
    countryCode: payload.countryCode?.trim() ?? current.countryCode,
  };

  if (!hasPersonalDetails(merged)) {
    const missing = logMissingPersonalDetails(merged);
    log('KYC submit rejected — missing personal details', { userId: id, missing });
    throw new Error('Please complete all personal details');
  }

  if (!payload.documentType.trim()) {
    throw new Error('Document type is required');
  }

  log('KYC submitted for review', {
    userId: id,
    documentType: payload.documentType,
    hasFront: Boolean(current.documentFrontUrl),
    hasBack: Boolean(current.documentBackUrl),
  });

  const phoneE164 = normalizePhoneForUser(merged.phone, merged.countryCode);
  await assertPhoneAvailable(id, phoneE164);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...merged,
      phoneE164,
      documentType: payload.documentType.trim(),
      kycStatus: KycStatus.PENDING,
      kycSubmittedAt: new Date(),
      kycRejectionReason: null,
      cardTermsAcceptedAt: new Date(),
    },
  });

  try {
    await ensureWalletForUser(updated);
  } catch (e) {
    if (e instanceof PhoneAlreadyInUseError) {
      throw e;
    }
    log('Wallet ensure failed after KYC submit', {
      userId: id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return updated;
}

export async function approveKyc(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: KycStatus.APPROVED,
      kycComplete: true,
      kycRejectionReason: null,
    },
  });
}

export async function rejectKyc(userId: string, reason: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: KycStatus.REJECTED,
      kycComplete: false,
      kycRejectionReason: reason,
    },
  });
}

export async function listUserCards(userId: string): Promise<VirtualCard[]> {
  return prisma.virtualCard.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findUserCard(
  userId: string,
  cardId: string,
): Promise<VirtualCard | null> {
  return prisma.virtualCard.findFirst({
    where: { id: cardId, userId },
  });
}

export async function updateVirtualCardStatus(
  cardId: string,
  status: VirtualCardStatus,
): Promise<VirtualCard> {
  return prisma.virtualCard.update({
    where: { id: cardId },
    data: { status },
  });
}

export async function syncVirtualCardFromStripe(
  stripeCardId: string,
  data: {
    last4?: string;
    expMonth?: number;
    expYear?: number;
    status?: VirtualCardStatus;
  },
): Promise<void> {
  await prisma.virtualCard.updateMany({
    where: { stripeCardId },
    data,
  });
}
