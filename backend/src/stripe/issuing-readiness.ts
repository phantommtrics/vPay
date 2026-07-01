import {
  getIssuingCurrency,
  isStablecoinIssuingEnabled,
  isStripeConfigured,
} from './client.js';

export type IssuingConfigValidation =
  | { ok: true; currency: string; stablecoin: boolean }
  | { ok: false; error: string };

/** Validate Stripe Issuing env before charging the user's wallet. */
export function validateIssuingConfig(): IssuingConfigValidation {
  if (!isStripeConfigured()) {
    return { ok: false, error: 'Stripe is not configured on this server.' };
  }

  const stablecoin = isStablecoinIssuingEnabled();
  const currency = getIssuingCurrency();
  const explicitCurrency = process.env.STRIPE_ISSUING_CURRENCY?.trim().toLowerCase();

  if (stablecoin && explicitCurrency && explicitCurrency !== 'usd') {
    return {
      ok: false,
      error:
        'STRIPE_ISSUING_CURRENCY conflicts with stablecoin Issuing (requires USD). Remove the override or unset STRIPE_ISSUING_PLATFORM_PROGRAM.',
    };
  }

  if (!stablecoin && currency === 'usd' && !explicitCurrency) {
    return {
      ok: false,
      error:
        'Stripe Issuing is not in stablecoin mode but card currency is USD. For UK test Issuing set STRIPE_ISSUING_CURRENCY=gbp (and STRIPE_TEST_CARDHOLDER_COUNTRY=gb if needed).',
    };
  }

  return { ok: true, currency, stablecoin };
}
