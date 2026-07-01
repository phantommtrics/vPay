import { log } from '../logger.js';
import type { ExchangeRateSyncConfig } from './config.js';

export type ExchangeRateApiResponse = {
  result: string;
  base_code?: string;
  conversion_rates?: Record<string, number>;
  time_last_update_utc?: string;
  'error-type'?: string;
  'extra-info'?: string;
};

export class ExchangeRateApiError extends Error {
  readonly requestedAt: string;
  readonly httpStatus?: number;

  constructor(message: string, options?: { requestedAt?: string; httpStatus?: number }) {
    super(message);
    this.name = 'ExchangeRateApiError';
    this.requestedAt = options?.requestedAt ?? new Date().toISOString();
    this.httpStatus = options?.httpStatus;
  }
}

function redactApiEndpoint(config: ExchangeRateSyncConfig): string {
  return `${config.apiBaseUrl}/***/latest/${config.baseCurrency}`;
}

function formatApiError(payload: ExchangeRateApiResponse, status: number): string {
  if (payload['error-type']) {
    const extra = payload['extra-info'] ? ` — ${payload['extra-info']}` : '';
    return `ExchangeRate-API error (${payload['error-type']})${extra}`;
  }
  return `ExchangeRate-API request failed (${status})`;
}

export async function fetchLatestExchangeRate(config: ExchangeRateSyncConfig): Promise<{
  rate: number;
  baseCurrency: string;
  targetCurrency: string;
  updatedAtUtc: string | null;
  requestedAt: string;
  respondedAt: string;
  httpStatus: number;
}> {
  const requestedAt = new Date().toISOString();
  const endpoint = redactApiEndpoint(config);

  log('Exchange rate API request', {
    requestedAt,
    endpoint,
    baseCurrency: config.baseCurrency,
    targetCurrency: config.targetCurrency,
  });

  const url = `${config.apiBaseUrl}/${config.apiKey}/latest/${config.baseCurrency}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    log('Exchange rate API request failed', {
      requestedAt,
      endpoint,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new ExchangeRateApiError(err instanceof Error ? err.message : String(err), { requestedAt });
  }

  const respondedAt = new Date().toISOString();
  const payload = (await response.json()) as ExchangeRateApiResponse;

  if (!response.ok || payload.result !== 'success') {
    const error = formatApiError(payload, response.status);
    log('Exchange rate API request failed', {
      requestedAt,
      respondedAt,
      endpoint,
      httpStatus: response.status,
      error,
    });
    throw new ExchangeRateApiError(error, { requestedAt, httpStatus: response.status });
  }

  const rawRate = payload.conversion_rates?.[config.targetCurrency];
  if (typeof rawRate !== 'number' || !Number.isFinite(rawRate) || rawRate <= 0) {
    const error = `ExchangeRate-API did not return a valid ${config.targetCurrency} rate`;
    log('Exchange rate API request failed', {
      requestedAt,
      respondedAt,
      endpoint,
      httpStatus: response.status,
      error,
    });
    throw new ExchangeRateApiError(error, { requestedAt, httpStatus: response.status });
  }

  const rate = rawRate;

  log('Exchange rate API response', {
    requestedAt,
    respondedAt,
    rate,
    baseCurrency: config.baseCurrency,
    targetCurrency: config.targetCurrency,
    sourceUpdatedAtUtc: payload.time_last_update_utc ?? null,
    httpStatus: response.status,
  });

  return {
    rate,
    baseCurrency: config.baseCurrency,
    targetCurrency: config.targetCurrency,
    updatedAtUtc: payload.time_last_update_utc ?? null,
    requestedAt,
    respondedAt,
    httpStatus: response.status,
  };
}
