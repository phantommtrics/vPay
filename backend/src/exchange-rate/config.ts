function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

export type ExchangeRateSyncConfig = {
  enabled: boolean;
  apiKey: string;
  intervalMs: number;
  baseCurrency: string;
  targetCurrency: string;
  apiBaseUrl: string;
};

export function getExchangeRateSyncConfig(): ExchangeRateSyncConfig | null {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY?.trim() ?? '';
  const hasApiKey = apiKey.length > 0;
  const enabled = parseEnvBoolean(process.env.EXCHANGE_RATE_SYNC_ENABLED, hasApiKey);
  if (!enabled || !hasApiKey) return null;

  const intervalMs = Math.max(
    10_000,
    parseEnvNumber(process.env.EXCHANGE_RATE_SYNC_INTERVAL_MS, 60_000),
  );

  return {
    enabled: true,
    apiKey,
    intervalMs,
    baseCurrency: (process.env.EXCHANGE_RATE_BASE_CURRENCY?.trim() || 'USD').toUpperCase(),
    targetCurrency: (process.env.EXCHANGE_RATE_TARGET_CURRENCY?.trim() || 'GMD').toUpperCase(),
    apiBaseUrl:
      process.env.EXCHANGE_RATE_API_BASE_URL?.trim() || 'https://v6.exchangerate-api.com/v6',
  };
}
