import type { Response } from 'express';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { reportCreatedAtFilter } from '../reports/date-range.js';
import { toAdminFundingOrder } from './admin-wallet.js';

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const reportQuerySchema = paginationSchema.superRefine((value, ctx) => {
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

export async function handleAdminReportWalletTransactions(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  let createdAtFilter;
  try {
    createdAtFilter = reportCreatedAtFilter(parsed.data.startDate, parsed.data.endDate);
  } catch {
    res.status(400).json({ error: 'Invalid date range' });
    return;
  }

  const limit = parsed.data.limit ?? 25;
  const rows = await prisma.walletTransaction.findMany({
    where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    include: {
      wallet: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const transactions = slice.map((tx) => ({
    id: tx.id,
    type: tx.type.toLowerCase(),
    amountGmd: tx.amountGmd,
    balanceAfterGmd: tx.balanceAfterGmd,
    description: tx.description,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt.toISOString(),
    user: tx.wallet.user,
  }));

  res.json({
    transactions,
    nextCursor: hasMore ? transactions[transactions.length - 1]?.id ?? null : null,
    limit,
  });
}

export async function handleAdminReportFundingOrders(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  let createdAtFilter;
  try {
    createdAtFilter = reportCreatedAtFilter(parsed.data.startDate, parsed.data.endDate);
  } catch {
    res.status(400).json({ error: 'Invalid date range' });
    return;
  }

  const limit = parsed.data.limit ?? 25;
  const rows = await prisma.fundingOrder.findMany({
    where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const orders = slice.map((order) => ({
    ...toAdminFundingOrder(order),
    user: order.user,
  }));

  res.json({
    orders,
    nextCursor: hasMore ? orders[orders.length - 1]?.id ?? null : null,
    limit,
  });
}
