export type PlatformConfig = {
  exchangeRate: number;
  feePercent: number;
  cardIssuanceFeeUsd: number;
  cardExpiryYears: number;
  source: 'catalog' | 'env';
};

let cached: PlatformConfig | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export function invalidatePlatformConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

export function setPlatformConfigCache(config: PlatformConfig): void {
  cached = config;
  cachedAt = Date.now();
}

export function getPlatformConfigCache(): PlatformConfig | null {
  if (!cached) return null;
  if (Date.now() - cachedAt > CACHE_TTL_MS) {
    cached = null;
    cachedAt = 0;
    return null;
  }
  return cached;
}
