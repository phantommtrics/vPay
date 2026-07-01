import { ExchangeRateSyncStatus } from '@prisma/client';

import { prisma } from '../db.js';

export type ExchangeRateSnapshotInput = {
  status: ExchangeRateSyncStatus;
  rate?: number | null;
  baseCurrency: string;
  targetCurrency: string;
  requestedAt: Date;
  respondedAt?: Date | null;
  sourceUpdatedAtUtc?: Date | null;
  httpStatus?: number | null;
  catalogUpdated?: boolean;
  previousRate?: number | null;
  errorMessage?: string | null;
};

function parseSourceUpdatedAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function recordExchangeRateSnapshot(input: ExchangeRateSnapshotInput): Promise<string> {
  const row = await prisma.exchangeRateSnapshot.create({
    data: {
      status: input.status,
      rate: input.rate ?? null,
      baseCurrency: input.baseCurrency,
      targetCurrency: input.targetCurrency,
      requestedAt: input.requestedAt,
      respondedAt: input.respondedAt ?? null,
      sourceUpdatedAtUtc: input.sourceUpdatedAtUtc ?? null,
      httpStatus: input.httpStatus ?? null,
      catalogUpdated: input.catalogUpdated ?? false,
      previousRate: input.previousRate ?? null,
      errorMessage: input.errorMessage ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

export function sourceUpdatedAtFromApi(value: string | null): Date | null {
  return parseSourceUpdatedAt(value);
}
