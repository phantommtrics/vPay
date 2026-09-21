import { AccountStatus, type User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import { resolveUserPhoneE164 } from '../phone.js';

/**
 * Deskline ops (WhatsApp chatbox + human escalation):
 * - Connect WhatsApp Business Cloud API on the vPay Deskline property.
 * - Train the AI on a vPay FAQ KB only. Never PAN, CVV, balances, or KYC files.
 * - On inbound WhatsApp, call POST /api/webhooks/deskline/whatsapp-identify
 *   with the sender E.164 and the `vPay help <token>` from the first message.
 * - If allowed=false, send UNMATCHED_WHATSAPP_MESSAGE and do not bind a customer.
 * - Escalate matched chats that are beyond the KB (or need account data) to staff.
 */

export const UNMATCHED_WHATSAPP_MESSAGE =
  'Please message us from the WhatsApp number registered on your vPay wallet.';

const SESSION_PURPOSE = 'whatsapp-support';
const SESSION_TTL = '10m';
const PREFILL_PREFIX = 'vPay help';

export type WhatsappUnavailableReason = 'not_configured' | 'no_phone';

export type PublicWhatsappConfig = {
  enabled: boolean;
  supportE164?: string;
  walletPhoneE164?: string;
  walletPhoneMasked?: string;
  unavailableReason?: WhatsappUnavailableReason;
};

export type WhatsappSession = PublicWhatsappConfig & {
  token: string;
  prefill: string;
};

export type WhatsappIdentifyResult = {
  allowed: boolean;
  userId?: string;
  displayName?: string;
  message?: string;
};

type WhatsappSessionPayload = {
  purpose: typeof SESSION_PURPOSE;
  sub: string;
  phoneE164: string;
};

function sessionSecret(): string {
  return (
    (process.env.WHATSAPP_SESSION_SECRET || '').trim() ||
    process.env.JWT_SECRET ||
    'dev-secret-change-in-production'
  );
}

export function getWhatsappIdentifySecret(): string {
  return (process.env.WHATSAPP_IDENTIFY_SECRET || '').trim();
}

export function getWhatsappSupportE164(): string | null {
  const raw = (process.env.WHATSAPP_SUPPORT_E164 || '').trim();
  if (!raw) return null;
  return canonicalizeE164(raw);
}

export function whatsappChannelConfigured(): boolean {
  return Boolean(getWhatsappSupportE164() && getWhatsappIdentifySecret());
}

export function canonicalizeE164(raw: string): string | null {
  const compact = raw.trim().replace(/[^\d+]/g, '');
  if (!compact) return null;
  const withPlus = compact.startsWith('+') ? compact : `+${compact.replace(/^0+/, '')}`;
  const digits = withPlus.slice(1);
  if (digits.length < 8 || digits.length > 15 || !/^\d+$/.test(digits)) return null;
  return `+${digits}`;
}

export function e164Digits(e164: string): string {
  return e164.replace(/[^\d]/g, '');
}

export function phonesMatch(a: string, b: string): boolean {
  const left = e164Digits(a);
  const right = e164Digits(b);
  return left.length >= 8 && left === right;
}

export function maskPhoneE164(e164: string): string {
  const digits = e164Digits(e164);
  if (digits.length < 6) return '••••';
  const ccLen = digits.startsWith('1') && digits.length >= 11 ? 1 : 3;
  const cc = digits.slice(0, Math.min(ccLen, digits.length - 2));
  return `+${cc} ••• ••${digits.slice(-2)}`;
}

export function walletPhoneE164ForUser(user: User): string | null {
  try {
    return resolveUserPhoneE164(user);
  } catch {
    return user.phoneE164?.trim() || null;
  }
}

function displayNameForUser(user: User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || 'Customer';
}

export function getPublicWhatsappConfig(user: User | null): PublicWhatsappConfig {
  const supportE164 = getWhatsappSupportE164();
  if (!supportE164 || !getWhatsappIdentifySecret()) {
    return { enabled: false, unavailableReason: 'not_configured' };
  }

  const walletPhoneE164 = user ? walletPhoneE164ForUser(user) : null;
  if (!walletPhoneE164) {
    return {
      enabled: false,
      supportE164,
      unavailableReason: 'no_phone',
    };
  }

  return {
    enabled: true,
    supportE164,
    walletPhoneE164,
    walletPhoneMasked: maskPhoneE164(walletPhoneE164),
  };
}

export function createWhatsappSession(user: User): WhatsappSession {
  const config = getPublicWhatsappConfig(user);
  if (!config.enabled || !config.walletPhoneE164 || !config.supportE164) {
    return config as WhatsappSession;
  }

  const token = jwt.sign(
    {
      purpose: SESSION_PURPOSE,
      sub: user.id,
      phoneE164: config.walletPhoneE164,
    } satisfies WhatsappSessionPayload,
    sessionSecret(),
    { expiresIn: SESSION_TTL },
  );

  return {
    ...config,
    token,
    prefill: `${PREFILL_PREFIX} ${token}`,
  };
}

export function extractWhatsappSessionToken(input: { token?: string; text?: string }): string | null {
  const direct = input.token?.trim();
  if (direct) return direct;

  const text = input.text?.trim() ?? '';
  if (!text) return null;
  const match = text.match(/\bvPay help\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function verifyWhatsappSessionToken(token: string): WhatsappSessionPayload | null {
  try {
    const payload = jwt.verify(token, sessionSecret()) as WhatsappSessionPayload;
    if (payload.purpose !== SESSION_PURPOSE) return null;
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) return null;
    const phoneE164 = canonicalizeE164(payload.phoneE164 || '');
    if (!phoneE164) return null;
    return { purpose: SESSION_PURPOSE, sub: payload.sub, phoneE164 };
  } catch {
    return null;
  }
}

export function identifySecretMatches(provided: string | undefined): boolean {
  const expected = getWhatsappIdentifySecret();
  if (!expected || !provided) return false;
  const got = provided.trim();
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function denied(reason: string, fromMasked?: string): WhatsappIdentifyResult {
  log('WhatsApp identify denied', { reason, fromMasked });
  return { allowed: false, message: UNMATCHED_WHATSAPP_MESSAGE };
}

async function findActiveUserByWalletPhone(fromE164: string): Promise<User | null> {
  const byUser = await prisma.user.findFirst({
    where: {
      phoneE164: fromE164,
      accountStatus: AccountStatus.ACTIVE,
    },
  });
  if (byUser) return byUser;

  const wallet = await prisma.vPayWallet.findUnique({
    where: { phoneNumber: fromE164 },
    include: { user: true },
  });
  if (wallet?.user.accountStatus === AccountStatus.ACTIVE) {
    return wallet.user;
  }
  return null;
}

export async function identifyWhatsappSender(input: {
  from: string;
  token?: string;
  text?: string;
}): Promise<WhatsappIdentifyResult> {
  const fromE164 = canonicalizeE164(input.from);
  if (!fromE164) {
    return denied('invalid_from');
  }
  const fromMasked = maskPhoneE164(fromE164);

  const token = extractWhatsappSessionToken(input);
  if (token) {
    const session = verifyWhatsappSessionToken(token);
    if (!session) {
      return denied('invalid_or_expired_token', fromMasked);
    }
    if (!phonesMatch(fromE164, session.phoneE164)) {
      return denied('from_mismatch_token', fromMasked);
    }

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
      return denied('user_inactive', fromMasked);
    }
    const walletPhone = walletPhoneE164ForUser(user);
    if (!walletPhone || !phonesMatch(fromE164, walletPhone)) {
      return denied('from_mismatch_wallet', fromMasked);
    }

    log('WhatsApp identify allowed', { userId: user.id, fromMasked });
    return {
      allowed: true,
      userId: user.id,
      displayName: displayNameForUser(user),
    };
  }

  const user = await findActiveUserByWalletPhone(fromE164);
  if (!user) {
    return denied('unknown_wallet_phone', fromMasked);
  }

  log('WhatsApp identify allowed', { userId: user.id, fromMasked, via: 'phone' });
  return {
    allowed: true,
    userId: user.id,
    displayName: displayNameForUser(user),
  };
}
