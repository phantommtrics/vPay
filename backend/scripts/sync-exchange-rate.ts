import 'dotenv/config';

import { prisma } from '../src/db.js';
import { getExchangeRateSyncConfig } from '../src/exchange-rate/config.js';
import { syncExchangeRateFromApi } from '../src/exchange-rate/sync.js';

async function main(): Promise<void> {
  const config = getExchangeRateSyncConfig();
  if (!config) {
    console.error(
      'Exchange rate sync is not configured. Set EXCHANGE_RATE_API_KEY (and EXCHANGE_RATE_SYNC_ENABLED=true if needed).',
    );
    process.exit(1);
  }

  const result = await syncExchangeRateFromApi(config);
  console.log(
    result.updated
      ? `Updated GMD/USD exchange rate: ${result.previousRate ?? '—'} → ${result.rate}`
      : `Exchange rate unchanged at ${result.rate}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
