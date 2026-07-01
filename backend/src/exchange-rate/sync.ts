import { ExchangeRateSyncStatus } from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import { warmPlatformConfigCache } from '../fund-config.js';
import { UCP_CODES } from '../settlement/catalog-codes.js';
import { invalidateSettlementCache } from '../settlement/resolver.js';
import { ExchangeRateApiError, fetchLatestExchangeRate } from './api.js';
import type { ExchangeRateSyncConfig } from './config.js';
import { recordExchangeRateSnapshot, sourceUpdatedAtFromApi } from './snapshots.js';

export type ExchangeRateSyncResult = {
  updated: boolean;
  rate: number;
  previousRate: number | null;
  ucpId: string;
  snapshotId: string;
};

export async function syncExchangeRateFromApi(
  config: ExchangeRateSyncConfig,
): Promise<ExchangeRateSyncResult> {
  const requestedAt = new Date();

  try {
    const fetchResult = await fetchLatestExchangeRate(config);
    const ucp = await prisma.ucp.findUnique({
      where: { code: UCP_CODES.GMD_USD_EXCHANGE_RATE },
      select: { id: true, fixedValue: true },
    });

    if (!ucp) {
      throw new Error(
        `UCP "${UCP_CODES.GMD_USD_EXCHANGE_RATE}" not found — run npm run seed:catalog first`,
      );
    }

    const { rate, targetCurrency, baseCurrency, updatedAtUtc, respondedAt, httpStatus } = fetchResult;
    const previousRate = ucp.fixedValue;
    const changed = previousRate == null || Math.abs(previousRate - rate) > 0.000_001;

    if (changed) {
      await prisma.ucp.update({
        where: { id: ucp.id },
        data: {
          fixedValue: rate,
          description: `Auto-synced from ExchangeRate-API (${targetCurrency} per ${baseCurrency})${
            updatedAtUtc ? ` — source updated ${updatedAtUtc}` : ''
          }`,
        },
      });
      invalidateSettlementCache();
      await warmPlatformConfigCache();
    }

    const snapshotId = await recordExchangeRateSnapshot({
      status: ExchangeRateSyncStatus.SUCCESS,
      rate,
      baseCurrency,
      targetCurrency,
      requestedAt: new Date(fetchResult.requestedAt),
      respondedAt: new Date(respondedAt),
      sourceUpdatedAtUtc: sourceUpdatedAtFromApi(updatedAtUtc),
      httpStatus,
      catalogUpdated: changed,
      previousRate,
    });

    log('Exchange rate catalog sync', {
      requestedAt: fetchResult.requestedAt,
      respondedAt,
      rate,
      previousRate,
      catalogUpdated: changed,
      ucpId: ucp.id,
      snapshotId,
      sourceUpdatedAtUtc: updatedAtUtc,
    });

    return {
      updated: changed,
      rate,
      previousRate,
      ucpId: ucp.id,
      snapshotId,
    };
  } catch (err) {
    const respondedAt = new Date();
    const errorMessage = err instanceof Error ? err.message : String(err);
    const httpStatus = err instanceof ExchangeRateApiError ? err.httpStatus : null;
    const failedRequestedAt =
      err instanceof ExchangeRateApiError ? new Date(err.requestedAt) : requestedAt;

    const snapshotId = await recordExchangeRateSnapshot({
      status: ExchangeRateSyncStatus.FAILED,
      baseCurrency: config.baseCurrency,
      targetCurrency: config.targetCurrency,
      requestedAt: failedRequestedAt,
      respondedAt,
      httpStatus,
      errorMessage,
    }).catch((persistErr) => {
      log('Exchange rate snapshot persist failed', {
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
      return null;
    });

    log('Exchange rate sync failed', {
      requestedAt: failedRequestedAt.toISOString(),
      respondedAt: respondedAt.toISOString(),
      snapshotId,
      error: errorMessage,
    });

    throw err;
  }
}
