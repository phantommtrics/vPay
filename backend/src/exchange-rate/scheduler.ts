import { log } from '../logger.js';
import { getExchangeRateSyncConfig } from './config.js';
import { syncExchangeRateFromApi } from './sync.js';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runSync(): Promise<void> {
  if (running) {
    log('Exchange rate sync skipped — previous run still in progress');
    return;
  }

  const config = getExchangeRateSyncConfig();
  if (!config) return;

  running = true;
  try {
    await syncExchangeRateFromApi(config);
  } catch {
    // Failure is logged and persisted in syncExchangeRateFromApi.
  } finally {
    running = false;
  }
}

export function startExchangeRateSyncScheduler(): void {
  const config = getExchangeRateSyncConfig();
  if (!config) {
    log('Exchange rate sync disabled — set EXCHANGE_RATE_API_KEY to enable');
    return;
  }

  if (timer) return;

  log('Exchange rate sync scheduler started', {
    intervalMs: config.intervalMs,
    baseCurrency: config.baseCurrency,
    targetCurrency: config.targetCurrency,
  });

  void runSync();
  timer = setInterval(() => {
    void runSync();
  }, config.intervalMs);
}

export function stopExchangeRateSyncScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  log('Exchange rate sync scheduler stopped');
}
