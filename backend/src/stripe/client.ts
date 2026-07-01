import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripeApiVersion = '2025-02-24.acacia' as const;
export const stripePreviewVersion = process.env.STRIPE_API_VERSION ?? '2026-05-27.preview';

export function isStripeConfigured(): boolean {
  return Boolean(secretKey && !secretKey.includes('...'));
}

export function getStripe(): Stripe {
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  return new Stripe(secretKey, {
    apiVersion: stripeApiVersion,
  });
}

export async function stripeV2Request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  options?: { stripeAccount?: string },
): Promise<T> {
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Stripe-Version': stripePreviewVersion,
    'Content-Type': 'application/json',
  };

  if (options?.stripeAccount) {
    headers['Stripe-Account'] = options.stripeAccount;
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Stripe v2 request failed: ${response.status}`);
  }

  return data;
}

export function getIssuingPlatformProgram(): string | null {
  const program = process.env.STRIPE_ISSUING_PLATFORM_PROGRAM;
  if (!program || program.includes('...')) {
    return null;
  }
  return program;
}

export function isStablecoinIssuingEnabled(): boolean {
  return Boolean(getIssuingPlatformProgram());
}

export function getPlatformFinancialAccountId(): string | null {
  const id = process.env.STRIPE_PLATFORM_FINANCIAL_ACCOUNT_ID?.trim();
  if (!id || id.includes('...')) {
    return null;
  }
  return id;
}

export function getStripePublishableKey(): string | null {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key || key.includes('...')) {
    return null;
  }
  return key;
}

/** Issuing card currency — stablecoin programs require USD; legacy UK test defaults to GBP. */
export function getIssuingCurrency(): string {
  const explicit = process.env.STRIPE_ISSUING_CURRENCY?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (isStablecoinIssuingEnabled()) {
    return 'usd';
  }
  return 'gbp';
}
