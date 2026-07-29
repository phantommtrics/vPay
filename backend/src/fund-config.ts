import { isPlatformDirectPayReady } from './directpay/platform.js';
import {
  getPlatformConfigCache,
  setPlatformConfigCache,
} from './settlement/config-cache.js';
import type { WalletTopupFeePricing } from './settlement/calculator.js';
import {
  getCardFundFeePricing,
  getCardExpiryConfigFromCatalog,
  getCardIssuanceConfigFromCatalog,
  getFundConfigFromCatalog,
  getPlatformConfig,
  getWalletTopupFeePricing,
} from './settlement/platform-config.js';

function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFundConfig() {
  const exchangeRate = parseEnvNumber(process.env.FUND_EXCHANGE_RATE, 71);
  const feePercent = parseEnvNumber(process.env.FUND_FEE_PERCENT, 0.02);

  return {
    exchangeRate: exchangeRate > 0 ? exchangeRate : 71,
    feePercent: feePercent >= 0 ? feePercent : 0.02,
    simulationEnabled: isFundSimulationEnabled(),
  };
}

/** Sync read — uses warm cache when available, otherwise env defaults. */
export function getFundConfig() {
  const cached = getPlatformConfigCache();
  if (cached) {
    return {
      exchangeRate: cached.exchangeRate,
      feePercent: cached.feePercent,
      simulationEnabled: isFundSimulationEnabled(),
    };
  }
  return envFundConfig();
}

export type FundConfigResponse = {
  exchangeRate: number;
  /** Present when wallet top-up uses a fixed rate UCP. */
  feePercent?: number;
  walletTopupFee: WalletTopupFeePricing;
  cardFundFee: WalletTopupFeePricing;
  simulationEnabled: boolean;
  /** True when real wallet top-ups can be started (simulation or platform directPay merchant linked). */
  directPayReady: boolean;
};

export async function getFundConfigAsync(): Promise<FundConfigResponse> {
  const simulationEnabled = isFundSimulationEnabled();
  const [{ exchangeRate }, walletTopupFee, cardFundFee, directPayReady] = await Promise.all([
    getFundConfigFromCatalog(),
    getWalletTopupFeePricing(),
    getCardFundFeePricing(),
    simulationEnabled ? Promise.resolve(true) : isPlatformDirectPayReady(),
  ]);

  return {
    exchangeRate,
    ...(walletTopupFee.type === 'fixed' ? { feePercent: walletTopupFee.feePercent } : {}),
    walletTopupFee,
    cardFundFee,
    simulationEnabled,
    directPayReady,
  };
}

/** Virtual card expiration — passed to Stripe on card create (exp_month / exp_year). */
export function getCardExpiryConfig() {
  const cached = getPlatformConfigCache();
  if (cached) {
    return { expiryYears: cached.cardExpiryYears };
  }
  const expiryYears = parseEnvNumber(process.env.CARD_EXPIRY_YEARS, 1);
  return {
    expiryYears: expiryYears > 0 ? expiryYears : 1,
  };
}

export async function getCardExpiryConfigAsync() {
  return getCardExpiryConfigFromCatalog();
}

/** One-time fee charged from the vPay wallet before Stripe card provisioning. */
export function getCardIssuanceConfig() {
  const cached = getPlatformConfigCache();
  if (cached) {
    const feeUsd = cached.cardIssuanceFeeUsd;
    return {
      feeUsd,
      feeGmd: Math.ceil(feeUsd * cached.exchangeRate),
      exchangeRate: cached.exchangeRate,
      required: feeUsd > 0,
    };
  }

  const { exchangeRate } = getFundConfig();
  const feeUsd = parseEnvNumber(process.env.CARD_ISSUANCE_FEE_USD, 1.5);
  const normalizedFeeUsd = feeUsd >= 0 ? feeUsd : 0;

  return {
    feeUsd: normalizedFeeUsd,
    feeGmd: Math.ceil(normalizedFeeUsd * exchangeRate),
    exchangeRate,
    required: normalizedFeeUsd > 0,
  };
}

export async function getCardIssuanceConfigAsync() {
  return getCardIssuanceConfigFromCatalog();
}

export async function warmPlatformConfigCache(): Promise<void> {
  const config = await getPlatformConfig();
  setPlatformConfigCache(config);
}

/** Dev-only: simulate funding without real directPay / wallet payments. */
export function isFundSimulationEnabled(): boolean {
  const explicit = process.env.FUND_SIMULATION_ENABLED?.trim().toLowerCase();
  if (explicit === 'true' || explicit === '1' || explicit === 'yes') return true;
  if (explicit === 'false' || explicit === '0' || explicit === 'no') return false;
  return (process.env.NODE_ENV ?? 'development') !== 'production';
}

const FUND_ERROR_RULES: Array<{ test: RegExp; message: string }> = [
  {
    test: /insufficient balance/i,
    message: 'Your wallet does not have enough balance for this payment.',
  },
  {
    test: /invalid otp|otp.*(invalid|expired|incorrect)/i,
    message: 'That code is incorrect or has expired. Please try again.',
  },
  {
    test: /does not match this order|authorization required|invalid aps checkout state|session expired/i,
    message: 'This payment session expired. Tap Fund card again to receive a new code.',
  },
  {
    test: /unauthorized|forbidden|not allowed/i,
    message: 'This payment could not be authorized. Please try again.',
  },
  {
    test: /timeout|timed out/i,
    message: 'The payment request timed out. Please try again.',
  },
  {
    test: /network|fetch failed|econnrefused/i,
    message: 'We could not reach the payment service. Please try again shortly.',
  },
];

function humanizeSnippet(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'Something went wrong. Please try again.';
  if (trimmed.length <= 120 && !trimmed.includes('directPay') && !trimmed.includes('/api/')) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return 'Something went wrong. Please try again.';
}

export function toUserFacingFundError(raw: string): string {
  const jsonMatch = raw.match(/"error"\s*:\s*"([^"]+)"/);
  const candidate = jsonMatch?.[1] ?? raw;

  for (const rule of FUND_ERROR_RULES) {
    if (rule.test.test(candidate)) return rule.message;
  }

  if (/directPay\s+\w+\s+\/[/\w-]+ failed:\s*\d+/i.test(raw)) {
    const tail = raw.replace(/^directPay\s+\w+\s+\/[\w/-]+\s+failed:\s*\d+\s*/i, '').trim();
    const plain = tail.replace(/^\{.*"error"\s*:\s*"([^"]+)".*\}$/s, '$1').trim();
    for (const rule of FUND_ERROR_RULES) {
      if (rule.test.test(plain)) return rule.message;
    }
    return humanizeSnippet(plain);
  }

  for (const rule of FUND_ERROR_RULES) {
    if (rule.test.test(raw)) return rule.message;
  }

  return humanizeSnippet(candidate);
}
