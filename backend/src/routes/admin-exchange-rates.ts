import type { Response } from 'express';
import { ExchangeRateSyncStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { reportCreatedAtFilter } from '../reports/date-range.js';

const pullsQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    targetCurrency: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate && !value.endDate) return;
    const start = value.startDate ?? value.endDate!;
    const end = value.endDate ?? value.startDate!;
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be on or before endDate',
      });
    }
  });

const querySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    chartLimit: z.coerce.number().int().min(1).max(5000).optional(),
    targetCurrency: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate && !value.endDate) return;
    const start = value.startDate ?? value.endDate!;
    const end = value.endDate ?? value.startDate!;
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be on or before endDate',
      });
    }
  });

export const adminExchangeRatesAuthorize = {
  list: authorize('system-config-exchange-rates', 'view'),
};

function toPublicSnapshot(row: {
  id: string;
  status: ExchangeRateSyncStatus;
  rate: number | null;
  baseCurrency: string;
  targetCurrency: string;
  requestedAt: Date;
  respondedAt: Date | null;
  sourceUpdatedAtUtc: Date | null;
  httpStatus: number | null;
  catalogUpdated: boolean;
  previousRate: number | null;
  errorMessage: string | null;
}) {
  return {
    id: row.id,
    status: row.status.toLowerCase(),
    rate: row.rate,
    baseCurrency: row.baseCurrency,
    targetCurrency: row.targetCurrency,
    requestedAt: row.requestedAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    sourceUpdatedAtUtc: row.sourceUpdatedAtUtc?.toISOString() ?? null,
    httpStatus: row.httpStatus,
    catalogUpdated: row.catalogUpdated,
    previousRate: row.previousRate,
    errorMessage: row.errorMessage,
  };
}

export async function handleAdminListExchangeRateSnapshots(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  let requestedAtFilter;
  try {
    requestedAtFilter = reportCreatedAtFilter(parsed.data.startDate, parsed.data.endDate);
  } catch {
    res.status(400).json({ error: 'Invalid date range' });
    return;
  }

  const chartLimit = parsed.data.chartLimit ?? 2000;
  const where = {
    ...(requestedAtFilter ? { requestedAt: requestedAtFilter } : {}),
    ...(parsed.data.targetCurrency ? { targetCurrency: parsed.data.targetCurrency } : {}),
  };

  const successWhere = {
    ...where,
    status: ExchangeRateSyncStatus.SUCCESS,
    rate: { not: null },
  };

  const [successRows, successCount, failureCount, latestSuccess] = await Promise.all([
    prisma.exchangeRateSnapshot.findMany({
      where: successWhere,
      orderBy: { requestedAt: 'asc' },
      take: chartLimit,
      select: {
        id: true,
        rate: true,
        requestedAt: true,
        catalogUpdated: true,
        previousRate: true,
      },
    }),
    prisma.exchangeRateSnapshot.count({ where: successWhere }),
    prisma.exchangeRateSnapshot.count({
      where: { ...where, status: ExchangeRateSyncStatus.FAILED },
    }),
    prisma.exchangeRateSnapshot.findFirst({
      where: { status: ExchangeRateSyncStatus.SUCCESS, rate: { not: null } },
      orderBy: { requestedAt: 'desc' },
    }),
  ]);

  const rates = successRows.map((row) => row.rate as number);
  const summary = {
    latestRate: latestSuccess?.rate ?? null,
    latestAt: latestSuccess?.requestedAt.toISOString() ?? null,
    baseCurrency: latestSuccess?.baseCurrency ?? 'USD',
    targetCurrency: latestSuccess?.targetCurrency ?? 'GMD',
    minRate: rates.length > 0 ? Math.min(...rates) : null,
    maxRate: rates.length > 0 ? Math.max(...rates) : null,
    successCount,
    failureCount,
    pullCount: successCount + failureCount,
  };

  res.json({
    summary,
    points: successRows.map((row) => ({
      id: row.id,
      requestedAt: row.requestedAt.toISOString(),
      rate: row.rate as number,
      catalogUpdated: row.catalogUpdated,
      previousRate: row.previousRate,
    })),
  });
}

export async function handleAdminListExchangeRatePulls(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = pullsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  let requestedAtFilter;
  try {
    requestedAtFilter = reportCreatedAtFilter(parsed.data.startDate, parsed.data.endDate);
  } catch {
    res.status(400).json({ error: 'Invalid date range' });
    return;
  }

  const limit = parsed.data.limit ?? 25;
  const where = {
    ...(requestedAtFilter ? { requestedAt: requestedAtFilter } : {}),
    ...(parsed.data.targetCurrency ? { targetCurrency: parsed.data.targetCurrency } : {}),
  };

  const rows = await prisma.exchangeRateSnapshot.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const records = slice.map(toPublicSnapshot);

  res.json({
    records,
    nextCursor: hasMore ? (records[records.length - 1]?.id ?? null) : null,
    limit,
  });
}
