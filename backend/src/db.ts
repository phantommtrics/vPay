import {
  DirectPayProvisioningStatus,
  KycStatus,
  Prisma,
  PrismaClient,
  StripeProvisioningStatus,
  VirtualCardStatus,
  type User,
  type VirtualCard,
} from '@prisma/client';

import { isVirtualCardActive } from './card-expiry.js';
import { findUserDeviceForAdmin, type AdminUserDevice } from './device/service.js';
import {
  getUserMonthlyDeviceUsage,
  isDeviceLockActiveOnDevice,
} from './device/limits.js';
import { getFundConfigAsync } from './fund-config.js';
import { log, logMissingPersonalDetails } from './logger.js';
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
  selfieUrl: string | null;
  kycSubmittedAt: string | null;
  kycRejectionReason: string | null;
  cardTermsAcceptedAt: string | null;
  stripeProvisioningStatus: 'none' | 'pending' | 'active' | 'failed';
  stripeProvisioningError: string | null;
  stripeConnectedAccountId: string | null;
  directPayProvisioningStatus: 'none' | 'pending' | 'active' | 'failed';
  directPayProvisioningError: string | null;
  directPayBusinessId: string | null;
  deviceLockEnabled: boolean;
  monthlyDevicesUsed: number;
  monthlyDevicesLimit: number;
};

export type PublicUserSession = PublicUser & {
  deviceLockActiveOnThisDevice: boolean;
};

export type AdminCardSummary = {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: 'active' | 'inactive' | 'canceled';
  expired: boolean;
  frozen: boolean;
};

export type AdminUser = PublicUser & {
  directPaySlug: string | null;
  cardIssuancePaidAt: string | null;
  cardIssuanceFeeUsd: number | null;
  virtualCardCount: number;
  latestCardLast4: string | null;
  hasActiveCard: boolean;
  cards: AdminCardSummary[];
  kycSubmittedDevice: AdminUserDevice | null;
  lockedDevice: AdminUserDevice | null;
  createdAt: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  kycStatus: PublicUser['kycStatus'];
  kycComplete: boolean;
  kycSubmittedAt: string | null;
  documentType: string | null;
  country: string | null;
  stripeProvisioningStatus: PublicUser['stripeProvisioningStatus'];
  directPayProvisioningStatus: PublicUser['directPayProvisioningStatus'];
  directPayBusinessId: string | null;
  createdAt: string;
};

export type PublicVirtualCard = {
  id: string;
  stripeCardId: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: 'active' | 'inactive' | 'canceled';
  expired: boolean;
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

export async function toPublicUser(user: User): Promise<PublicUser> {
  const monthlyUsage = await getUserMonthlyDeviceUsage(user.id);

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
    selfieUrl: user.selfieUrl,
    kycSubmittedAt: user.kycSubmittedAt?.toISOString() ?? null,
    kycRejectionReason: user.kycRejectionReason,
    cardTermsAcceptedAt: user.cardTermsAcceptedAt?.toISOString() ?? null,
    stripeProvisioningStatus: toProvisioningStatus(user.stripeProvisioningStatus),
    stripeProvisioningError: user.stripeProvisioningError,
    stripeConnectedAccountId: user.stripeConnectedAccountId,
    directPayProvisioningStatus: toDirectPayProvisioningStatus(user.directPayProvisioningStatus),
    directPayProvisioningError: user.directPayProvisioningError,
    directPayBusinessId: user.directPayBusinessId,
    deviceLockEnabled: user.deviceLockEnabled,
    monthlyDevicesUsed: monthlyUsage.used,
    monthlyDevicesLimit: monthlyUsage.limit,
  };
}

export async function toPublicUserSession(
  user: User,
  currentDeviceId?: string | null,
): Promise<PublicUserSession> {
  const base = await toPublicUser(user);
  return {
    ...base,
    deviceLockActiveOnThisDevice: await isDeviceLockActiveOnDevice(user, currentDeviceId),
  };
}

export function toAdminUserSummary(user: User): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    kycStatus: toKycStatus(user.kycStatus),
    kycComplete: user.kycComplete,
    kycSubmittedAt: user.kycSubmittedAt?.toISOString() ?? null,
    documentType: user.documentType,
    country: user.country,
    stripeProvisioningStatus: toProvisioningStatus(user.stripeProvisioningStatus),
    directPayProvisioningStatus: toDirectPayProvisioningStatus(user.directPayProvisioningStatus),
    directPayBusinessId: user.directPayBusinessId,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAdminCardSummary(card: VirtualCard): AdminCardSummary {
  const status = card.status.toLowerCase() as AdminCardSummary['status'];
  const expired = !isVirtualCardActive(card);
  return {
    id: card.id,
    last4: card.last4,
    brand: card.brand,
    expMonth: card.expMonth,
    expYear: card.expYear,
    status,
    expired,
    frozen: card.status === VirtualCardStatus.INACTIVE,
  };
}

export async function toAdminUser(user: User): Promise<AdminUser> {
  const cards = await listUserCards(user.id);
  const latest = cards[0] ?? null;
  const summaries = cards.map(toAdminCardSummary);
  const hasActiveCard = cards.some((c) => isVirtualCardActive(c));
  const kycSubmittedDevice = user.kycSubmittedDeviceId
    ? await findUserDeviceForAdmin(user.id, user.kycSubmittedDeviceId)
    : null;
  const lockedDevice = user.lockedDeviceId
    ? await findUserDeviceForAdmin(user.id, user.lockedDeviceId)
    : null;

  return {
    ...(await toPublicUser(user)),
    directPaySlug: user.directPaySlug,
    cardIssuancePaidAt: user.cardIssuancePaidAt?.toISOString() ?? null,
    cardIssuanceFeeUsd: user.cardIssuanceFeeUsd,
    virtualCardCount: cards.length,
    latestCardLast4: latest?.last4 ?? null,
    hasActiveCard,
    cards: summaries,
    kycSubmittedDevice,
    lockedDevice,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function toPublicVirtualCard(
  card: VirtualCard,
  user: User,
): Promise<PublicVirtualCard> {
  const { exchangeRate } = await getFundConfigAsync();
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
    expired: !isVirtualCardActive(card),
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
    selfieUrl?: string;
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
  deviceId?: string | null,
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

  if (!current.selfieUrl) {
    throw new Error('Selfie photo is required');
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
    hasSelfie: Boolean(current.selfieUrl),
    deviceId: deviceId ?? null,
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
      kycSubmittedDeviceId: deviceId ?? null,
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

export async function findLatestUserCard(userId: string): Promise<VirtualCard | null> {
  return prisma.virtualCard.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
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

export async function listAdminUsers(params: {
  kycStatus?: KycStatus;
  search?: string;
  stripeStatus?: StripeProvisioningStatus;
  directPayStatus?: DirectPayProvisioningStatus;
  page?: number;
  limit?: number;
}): Promise<{ users: User[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (params.kycStatus) {
    where.kycStatus = params.kycStatus;
  }
  if (params.stripeStatus) {
    where.stripeProvisioningStatus = params.stripeStatus;
  }
  if (params.directPayStatus) {
    where.directPayProvisioningStatus = params.directPayStatus;
  }
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ kycSubmittedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

export async function getAdminStats(): Promise<{
  pendingKyc: number;
  activeCards: number;
  totalUsers: number;
  walletsWithBalance: number;
  totalWalletBalanceGmd: number;
  pendingFundingOrders: number;
  depositsLast7Days: number;
  directPayMerchantEmail: string | null;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    pendingKyc,
    activeCards,
    totalUsers,
    walletAgg,
    pendingFundingOrders,
    depositsLast7Days,
    directPayHolder,
  ] = await Promise.all([
    prisma.user.count({ where: { kycStatus: KycStatus.PENDING } }),
    prisma.virtualCard.count({ where: { status: VirtualCardStatus.ACTIVE } }),
    prisma.user.count(),
    prisma.vPayWallet.aggregate({ _sum: { balanceGmd: true }, _count: { id: true } }),
    prisma.fundingOrder.count({ where: { status: 'PENDING' } }),
    prisma.walletTransaction.count({
      where: { type: 'DEPOSIT', createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.user.findFirst({
      where: { directPayBusinessId: { not: null } },
      select: { email: true },
    }),
  ]);

  const walletsWithBalance = await prisma.vPayWallet.count({
    where: { balanceGmd: { gt: 0 } },
  });

  return {
    pendingKyc,
    activeCards,
    totalUsers,
    walletsWithBalance,
    totalWalletBalanceGmd: walletAgg._sum.balanceGmd ?? 0,
    pendingFundingOrders,
    depositsLast7Days,
    directPayMerchantEmail: directPayHolder?.email ?? null,
  };
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
