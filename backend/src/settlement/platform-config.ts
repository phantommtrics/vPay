import { PRODUCT_CODES, UCP_CODES } from './catalog-codes.js';
import {
  calculateWalletTopupFeeFromPricing,
  type WalletTopupFeePricing,
} from './calculator.js';
import { resolveScalarFromSettlement, resolveUcpForProduct } from './resolver.js';
import {
  getPlatformConfigCache,
  setPlatformConfigCache,
  type PlatformConfig,
} from './config-cache.js';

function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envPlatformConfig(): PlatformConfig {
  const exchangeRate = parseEnvNumber(process.env.FUND_EXCHANGE_RATE, 71);
  const feePercent = parseEnvNumber(process.env.FUND_FEE_PERCENT, 0.02);
  const cardIssuanceFeeUsd = parseEnvNumber(process.env.CARD_ISSUANCE_FEE_USD, 1.5);
  const cardExpiryYears = parseEnvNumber(process.env.CARD_EXPIRY_YEARS, 1);

  return {
    exchangeRate: exchangeRate > 0 ? exchangeRate : 71,
    feePercent: feePercent >= 0 ? feePercent : 0.02,
    cardIssuanceFeeUsd: cardIssuanceFeeUsd >= 0 ? cardIssuanceFeeUsd : 0,
    cardExpiryYears: cardExpiryYears > 0 ? cardExpiryYears : 1,
    source: 'env',
  };
}

async function loadPlatformConfigFromCatalog(): Promise<PlatformConfig> {
  const [exchangeRate, feePercent, cardIssuanceFeeUsd, cardExpiryYears] = await Promise.all([
    resolveScalarFromSettlement(PRODUCT_CODES.EXCHANGE_RATE, UCP_CODES.GMD_USD_EXCHANGE_RATE),
    resolveScalarFromSettlement(PRODUCT_CODES.WALLET_TOPUP, UCP_CODES.WALLET_TOPUP_FEE_PERCENT),
    resolveScalarFromSettlement(PRODUCT_CODES.CARD_ISSUANCE, UCP_CODES.CARD_ISSUANCE_FEE_USD),
    resolveScalarFromSettlement(PRODUCT_CODES.CARD_EXPIRY, UCP_CODES.CARD_EXPIRY_YEARS),
  ]);

  const env = envPlatformConfig();

  return {
    exchangeRate: exchangeRate ?? env.exchangeRate,
    feePercent: feePercent ?? env.feePercent,
    cardIssuanceFeeUsd: cardIssuanceFeeUsd ?? env.cardIssuanceFeeUsd,
    cardExpiryYears: cardExpiryYears ?? env.cardExpiryYears,
    source:
      exchangeRate != null || feePercent != null || cardIssuanceFeeUsd != null || cardExpiryYears != null
        ? 'catalog'
        : 'env',
  };
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const hit = getPlatformConfigCache();
  if (hit) return hit;

  try {
    const config = await loadPlatformConfigFromCatalog();
    setPlatformConfigCache(config);
    return config;
  } catch {
    const config = envPlatformConfig();
    setPlatformConfigCache(config);
    return config;
  }
}

export async function getFundConfigFromCatalog() {
  const { exchangeRate, feePercent } = await getPlatformConfig();
  return { exchangeRate, feePercent };
}

export async function getCardIssuanceConfigFromCatalog() {
  const { exchangeRate, cardIssuanceFeeUsd } = await getPlatformConfig();
  const feeUsd = cardIssuanceFeeUsd;
  return {
    feeUsd,
    feeGmd: Math.ceil(feeUsd * exchangeRate),
    exchangeRate,
    required: feeUsd > 0,
  };
}

export async function getCardExpiryConfigFromCatalog() {
  const { cardExpiryYears } = await getPlatformConfig();
  return { expiryYears: cardExpiryYears };
}

export async function getWalletTopupFeePricing(): Promise<WalletTopupFeePricing> {
  const env = envPlatformConfig();
  try {
    const ucp = await resolveUcpForProduct(PRODUCT_CODES.WALLET_TOPUP, UCP_CODES.WALLET_TOPUP_FEE_PERCENT);
    if (!ucp) {
      return { type: 'fixed', feePercent: env.feePercent };
    }
    if (ucp.ucpType === 'SLAB') {
      return {
        type: 'slab',
        slabs: ucp.slabs.map((slab) => ({
          minAmount: slab.minAmount,
          maxAmount: slab.maxAmount,
          value: slab.value,
          valueType: slab.valueType,
          sortOrder: slab.sortOrder,
        })),
      };
    }
    return { type: 'fixed', feePercent: ucp.fixedValue ?? env.feePercent };
  } catch {
    return { type: 'fixed', feePercent: env.feePercent };
  }
}

export async function calculateWalletTopupFee(amountGmd: number): Promise<{
  feeGmd: number;
  totalGmd: number;
  feePercent: number;
  walletTopupFee: WalletTopupFeePricing;
}> {
  const pricing = await getWalletTopupFeePricing();
  const feeGmd = calculateWalletTopupFeeFromPricing(pricing, amountGmd);
  const feePercent =
    pricing.type === 'fixed'
      ? pricing.feePercent
      : amountGmd > 0
        ? feeGmd / amountGmd
        : 0;

  return {
    walletTopupFee: pricing,
    feePercent,
    feeGmd,
    totalGmd: amountGmd + feeGmd,
  };
}
