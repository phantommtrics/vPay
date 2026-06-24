import type { User } from '@prisma/client';
import type Stripe from 'stripe';

import { log } from '../logger.js';
import { getStripe, getIssuingPlatformProgram, getIssuingCurrency, stripeApiVersion } from './client.js';
import {
  buildBillingAddress,
  getCardholderName,
  getTermsAcceptanceIp,
  getTermsAcceptanceUnix,
  normalizePhoneE164,
  parseDateOfBirth,
  resolveCountryCode,
} from './mappers.js';

export type IssuedCard = {
  stripeCardId: string;
  stripeCardholderId: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: 'active' | 'inactive' | 'canceled';
};

export async function enableIssuingProgram(connectedAccountId: string): Promise<void> {
  if (connectedAccountId.startsWith('platform:')) {
    return;
  }

  const program = getIssuingPlatformProgram();
  if (!program) {
    return;
  }

  const stripe = getStripe();
  await stripe.rawRequest(
    'POST',
    '/v1/issuing/programs',
    {
      platform_program: program,
      is_default: true,
    },
    {
      apiVersion: `${process.env.STRIPE_API_VERSION ?? '2026-05-27.preview'}; issuing_program_beta=v2`,
      additionalHeaders: {
        'Stripe-Account': connectedAccountId,
      },
    },
  );
}

export async function createCardholder(
  user: User,
  connectedAccountId: string,
): Promise<string> {
  if (connectedAccountId.startsWith('platform:')) {
    return connectedAccountId.replace('platform:', '');
  }

  const stripe = getStripe();
  const countryCode = resolveCountryCode(user);
  const dob = parseDateOfBirth(user.dateOfBirth!);
  const billing = buildBillingAddress(user);

  const cardholder = await stripe.issuing.cardholders.create(
    {
      type: 'individual',
      name: getCardholderName(user),
      email: user.email,
      phone_number: normalizePhoneE164(user.phone!, countryCode),
      status: 'active',
      individual: {
        first_name: user.firstName!.trim(),
        last_name: user.lastName!.trim(),
        dob,
        card_issuing: {
          user_terms_acceptance: {
            date: getTermsAcceptanceUnix(user),
            ip: getTermsAcceptanceIp(user),
          },
        },
      },
      billing: {
        address: billing,
      },
    },
    { stripeAccount: connectedAccountId },
  );

  return cardholder.id;
}

export async function createVirtualCard(
  user: User,
  connectedAccountId: string,
  cardholderId: string,
  financialAccountId: string,
): Promise<IssuedCard> {
  const stripe = getStripe();
  const isPlatform = connectedAccountId.startsWith('platform:');

  const params: Stripe.Issuing.CardCreateParams = {
    cardholder: cardholderId,
    currency: getIssuingCurrency(),
    type: 'virtual',
    status: 'active',
  };

  if (!isPlatform && financialAccountId !== 'platform') {
    (params as Stripe.Issuing.CardCreateParams & { financial_account_v2?: string }).financial_account_v2 =
      financialAccountId;
  }

  const card = await stripe.issuing.cards.create(
    params,
    isPlatform ? undefined : { stripeAccount: connectedAccountId },
  );

  log('Stripe virtual card created', {
    userId: user.id,
    cardId: card.id,
    last4: card.last4,
  });

  return {
    stripeCardId: card.id,
    stripeCardholderId: cardholderId,
    last4: card.last4,
    brand: card.brand,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    status: card.status,
  };
}

export async function updateCardStatus(
  stripeCardId: string,
  connectedAccountId: string | null,
  status: 'active' | 'inactive',
): Promise<void> {
  const stripe = getStripe();
  const options =
    connectedAccountId && !connectedAccountId.startsWith('platform:')
      ? { stripeAccount: connectedAccountId }
      : undefined;

  await stripe.issuing.cards.update(stripeCardId, { status }, options);
}

export async function createEphemeralKey(
  stripeCardId: string,
  nonce: string,
  connectedAccountId: string | null,
): Promise<string> {
  const stripe = getStripe();
  const options: Stripe.RequestOptions = {
    apiVersion: stripeApiVersion,
  };

  if (connectedAccountId && !connectedAccountId.startsWith('platform:')) {
    options.stripeAccount = connectedAccountId;
  }

  const key = await stripe.ephemeralKeys.create(
    {
      nonce,
      issuing_card: stripeCardId,
    },
    options,
  );

  if (!key.secret) {
    throw new Error('Failed to create ephemeral key');
  }

  return key.secret;
}

export type FinancialAccountBalance = {
  balanceUsd: number;
  balanceSource: 'stripe' | 'unavailable';
};

export async function getFinancialAccountBalanceUsd(
  financialAccountId: string | null,
  connectedAccountId: string | null,
): Promise<FinancialAccountBalance> {
  if (!financialAccountId || financialAccountId === 'platform' || !connectedAccountId) {
    return { balanceUsd: 0, balanceSource: 'unavailable' };
  }

  if (connectedAccountId.startsWith('platform:')) {
    return { balanceUsd: 0, balanceSource: 'unavailable' };
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v2/money_management/financial_accounts/${financialAccountId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Stripe-Version': process.env.STRIPE_API_VERSION ?? '2026-05-27.preview',
          'Stripe-Account': connectedAccountId,
        },
      },
    );

    if (response.ok) {
      const data = (await response.json()) as {
        balances?: {
          available?: {
            usdc?: { value?: number };
            usd?: { value?: number };
          };
        };
      };
      const usdcCents = data.balances?.available?.usdc?.value ?? 0;
      const usdCents = data.balances?.available?.usd?.value ?? 0;
      const stripeBalance = (usdcCents + usdCents) / 100;
      return { balanceUsd: stripeBalance, balanceSource: 'stripe' };
    }
  } catch {
    // fall through
  }

  return { balanceUsd: 0, balanceSource: 'unavailable' };
}
