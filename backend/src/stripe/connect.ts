import type { User } from '@prisma/client';

import { log } from '../logger.js';
import { getStripe, getIssuingPlatformProgram, stripeV2Request } from './client.js';
import {
  buildBillingAddress,
  getCardholderName,
  getTermsAcceptanceIp,
  getTermsAcceptanceUnix,
  normalizePhoneE164,
  parseDateOfBirth,
  resolveCountryCode,
} from './mappers.js';

type V2Account = {
  id: string;
  configuration?: {
    storer?: { holds_currencies?: { usdc?: { status?: string } } };
    card_creator?: {
      commercial?: { lead?: { prepaid_card?: { status?: string } } };
    };
  };
};

type V2FinancialAccount = {
  id: string;
};

export async function createConnectedAccount(user: User): Promise<string> {
  const countryCode = resolveCountryCode(user);
  const program = getIssuingPlatformProgram();

  if (!program) {
    return createPlatformCardholderOnly(user);
  }

  const account = await stripeV2Request<V2Account>('POST', '/v2/core/accounts', {
    contact_email: user.email,
    display_name: getCardholderName(user),
    identity: {
      country: countryCode,
      entity_type: 'individual',
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
      storer: {
        capabilities: {
          holds_currencies: {
            usdc: { requested: true },
          },
          outbound_transfers: {
            crypto_wallets: { requested: true },
          },
        },
      },
      card_creator: {
        capabilities: {
          commercial: {
            lead: {
              prepaid_card: { requested: true },
            },
          },
        },
      },
    },
    dashboard: 'none',
    defaults: {
      currency: 'usdc',
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'application',
      },
    },
  });

  log('Stripe connected account created', { userId: user.id, accountId: account.id });
  return account.id;
}

async function createPlatformCardholderOnly(user: User): Promise<string> {
  const stripe = getStripe();
  const countryCode = resolveCountryCode(user);
  const dob = parseDateOfBirth(user.dateOfBirth!);
  const billing = buildBillingAddress(user);

  const cardholder = await stripe.issuing.cardholders.create({
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
  });

  log('Stripe platform cardholder created (test fallback)', {
    userId: user.id,
    cardholderId: cardholder.id,
  });

  return `platform:${cardholder.id}`;
}

export async function waitForAccountCapabilities(
  connectedAccountId: string,
  maxAttempts = 10,
): Promise<void> {
  if (connectedAccountId.startsWith('platform:')) {
    return;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const account = await stripeV2Request<V2Account>(
      'GET',
      `/v2/core/accounts/${connectedAccountId}?include%5B0%5D=configuration.storer&include%5B1%5D=configuration.card_creator`,
    );

    const storerActive =
      account.configuration?.storer?.holds_currencies?.usdc?.status === 'active';
    const cardCreatorActive =
      account.configuration?.card_creator?.commercial?.lead?.prepaid_card?.status ===
      'active';

    if (storerActive && cardCreatorActive) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  log('Stripe account capabilities not active yet; continuing provisioning', {
    connectedAccountId,
  });
}

export async function createFinancialAccount(connectedAccountId: string): Promise<string> {
  if (connectedAccountId.startsWith('platform:')) {
    return 'platform';
  }

  const financialAccount = await stripeV2Request<V2FinancialAccount>(
    'POST',
    '/v2/money_management/financial_accounts',
    {
      type: 'storage',
      storage: {
        holds_currencies: ['usdc'],
      },
    },
    { stripeAccount: connectedAccountId },
  );

  return financialAccount.id;
}
