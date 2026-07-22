import type { Response } from 'express';
import { JournalAccountType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { resolveBoundedReportDateRange } from '../reports/date-range.js';
import { nextCursorFromItems, parseReportLimit } from '../reports/pagination.js';
import { formatZodError } from '../zod-utils.js';

const journalAccountTypeSchema = z.nativeEnum(JournalAccountType);

const reportQuerySchema = z
  .object({
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
    referenceType: z.string().min(1).max(64).optional(),
    accountType: journalAccountTypeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate && !value.endDate) return;
    const start = value.startDate ?? value.endDate!;
    const end = value.endDate ?? value.startDate!;
    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be on or before endDate',
        path: ['endDate'],
      });
    }
  });

function formatJournalLine(
  line: {
    id: string;
    accountType: JournalAccountType;
    accountId: string;
    debit: number;
    credit: number;
    walletTransactionId: string | null;
    businessAccountTransactionId: string | null;
    sortOrder: number;
  },
  names?: { accountName: string; accountCode: string },
) {
  return {
    id: line.id,
    accountType: line.accountType,
    accountId: line.accountId,
    accountName: names?.accountName ?? line.accountId,
    accountCode: names?.accountCode ?? line.accountId,
    debit: line.debit,
    credit: line.credit,
    walletTransactionId: line.walletTransactionId,
    businessAccountTransactionId: line.businessAccountTransactionId,
    sortOrder: line.sortOrder,
  };
}

function formatJournalEntrySummary(entry: {
  id: string;
  referenceType: string;
  referenceId: string;
  description: string | null;
  postedAt: Date;
  createdAt: Date;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
}) {
  return {
    id: entry.id,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    description: entry.description,
    postedAt: entry.postedAt.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    totalDebit: entry.totalDebit,
    totalCredit: entry.totalCredit,
    lineCount: entry.lineCount,
  };
}

function parseTrialBalanceCursor(cursor?: string): {
  accountType: JournalAccountType;
  accountId: string;
} | null {
  if (!cursor) return null;
  const separator = cursor.indexOf(':');
  if (separator <= 0) return null;
  const accountType = cursor.slice(0, separator) as JournalAccountType;
  const accountId = cursor.slice(separator + 1);
  if (!accountId) return null;
  if (accountType !== JournalAccountType.CUSTOMER_WALLET && accountType !== JournalAccountType.BUSINESS_ACCOUNT) {
    return null;
  }
  return { accountType, accountId };
}

function encodeTrialBalanceCursor(accountType: JournalAccountType, accountId: string): string {
  return `${accountType}:${accountId}`;
}

type AggregatedTrialRow = {
  accountType: JournalAccountType;
  accountId: string;
  totalDebit: number;
  totalCredit: number;
};

export async function handleAdminReportJournalEntries(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  let dateRange;
  try {
    dateRange = resolveBoundedReportDateRange({
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid date range' });
    return;
  }

  const limit = parseReportLimit(parsed.data.limit);
  const rows = await prisma.journalEntry.findMany({
    where: {
      postedAt: dateRange.filter,
      ...(parsed.data.referenceType ? { referenceType: parsed.data.referenceType } : {}),
    },
    orderBy: [{ postedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      referenceType: true,
      referenceId: true,
      description: true,
      postedAt: true,
      createdAt: true,
      totalDebit: true,
      totalCredit: true,
      lineCount: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    items: items.map(formatJournalEntrySummary),
    nextCursor: nextCursorFromItems(items, hasMore, (item) => item.id),
    hasMore,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
}

export async function handleAdminReportJournalEntryDetail(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const entryId = Array.isArray(id) ? id[0] : id;

  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!entry) {
    res.status(404).json({ error: 'Journal entry not found' });
    return;
  }

  const walletIds = entry.lines
    .filter((line) => line.accountType === JournalAccountType.CUSTOMER_WALLET)
    .map((line) => line.accountId);
  const businessIds = entry.lines
    .filter((line) => line.accountType === JournalAccountType.BUSINESS_ACCOUNT)
    .map((line) => line.accountId);

  const [wallets, businessAccounts] = await Promise.all([
    walletIds.length
      ? prisma.vPayWallet.findMany({
          where: { id: { in: walletIds } },
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        })
      : [],
    businessIds.length
      ? prisma.businessAccount.findMany({ where: { id: { in: businessIds } } })
      : [],
  ]);

  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const businessMap = new Map(businessAccounts.map((a) => [a.id, a]));

  function resolveNames(line: {
    accountType: JournalAccountType;
    accountId: string;
  }): { accountName: string; accountCode: string } {
    if (line.accountType === JournalAccountType.CUSTOMER_WALLET) {
      const wallet = walletMap.get(line.accountId);
      if (!wallet) {
        return { accountName: 'Unknown wallet', accountCode: line.accountId };
      }
      const name =
        [wallet.user.firstName, wallet.user.lastName].filter(Boolean).join(' ') || wallet.user.email;
      return { accountName: name, accountCode: wallet.phoneNumber ?? line.accountId };
    }

    const account = businessMap.get(line.accountId);
    if (!account) {
      return { accountName: 'Unknown account', accountCode: line.accountId };
    }
    return { accountName: account.name, accountCode: account.code };
  }

  res.json({
    ...formatJournalEntrySummary(entry),
    lines: entry.lines.map((line) => formatJournalLine(line, resolveNames(line))),
  });
}

export async function handleAdminReportTrialBalance(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  let dateRange;
  try {
    dateRange = resolveBoundedReportDateRange({
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid date range' });
    return;
  }

  const limit = parseReportLimit(parsed.data.limit);
  const cursor = parseTrialBalanceCursor(parsed.data.cursor);
  const accountTypeFilter = parsed.data.accountType ?? null;

  const totals = await prisma.$queryRaw<Array<{ totalDebit: number; totalCredit: number }>>(
    Prisma.sql`
      SELECT
        COALESCE(SUM(jl.debit), 0)::float AS "totalDebit",
        COALESCE(SUM(jl.credit), 0)::float AS "totalCredit"
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.posted_at >= ${dateRange.filter.gte}
        AND je.posted_at < ${dateRange.filter.lt}
        ${accountTypeFilter ? Prisma.sql`AND jl.account_type = ${accountTypeFilter}::"JournalAccountType"` : Prisma.empty}
    `,
  );

  const aggregated = await prisma.$queryRaw<AggregatedTrialRow[]>(
    Prisma.sql`
      SELECT
        jl.account_type AS "accountType",
        jl.account_id AS "accountId",
        COALESCE(SUM(jl.debit), 0)::float AS "totalDebit",
        COALESCE(SUM(jl.credit), 0)::float AS "totalCredit"
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.posted_at >= ${dateRange.filter.gte}
        AND je.posted_at < ${dateRange.filter.lt}
        ${accountTypeFilter ? Prisma.sql`AND jl.account_type = ${accountTypeFilter}::"JournalAccountType"` : Prisma.empty}
        ${
          cursor
            ? Prisma.sql`AND (jl.account_type, jl.account_id) > (${cursor.accountType}::"JournalAccountType", ${cursor.accountId})`
            : Prisma.empty
        }
      GROUP BY jl.account_type, jl.account_id
      ORDER BY jl.account_type ASC, jl.account_id ASC
      LIMIT ${limit + 1}
    `,
  );

  const hasMore = aggregated.length > limit;
  const slice = hasMore ? aggregated.slice(0, limit) : aggregated;

  const walletIds = slice
    .filter((row) => row.accountType === JournalAccountType.CUSTOMER_WALLET)
    .map((row) => row.accountId);
  const businessIds = slice
    .filter((row) => row.accountType === JournalAccountType.BUSINESS_ACCOUNT)
    .map((row) => row.accountId);

  const [wallets, businessAccounts] = await Promise.all([
    walletIds.length
      ? prisma.vPayWallet.findMany({
          where: { id: { in: walletIds } },
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        })
      : [],
    businessIds.length
      ? prisma.businessAccount.findMany({
          where: { id: { in: businessIds } },
          include: { entity: { select: { name: true } } },
        })
      : [],
  ]);

  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const businessMap = new Map(businessAccounts.map((a) => [a.id, a]));

  const rows = slice.map((row) => {
    const netBalance = row.totalDebit - row.totalCredit;
    if (row.accountType === JournalAccountType.CUSTOMER_WALLET) {
      const wallet = walletMap.get(row.accountId);
      return {
        ...row,
        netBalance,
        accountCode: wallet?.phoneNumber ?? row.accountId,
        accountName: wallet
          ? [wallet.user.firstName, wallet.user.lastName].filter(Boolean).join(' ') ||
            wallet.user.email
          : 'Unknown wallet',
        liveBalance: wallet?.balanceGmd ?? null,
        currency: 'GMD',
      };
    }

    const account = businessMap.get(row.accountId);
    return {
      ...row,
      netBalance,
      accountCode: account?.code ?? row.accountId,
      accountName: account?.name ?? 'Unknown account',
      liveBalance: account?.balance ?? null,
      currency: account?.currency ?? 'GMD',
      entityName: account?.entity.name ?? null,
    };
  });

  const periodTotals = totals[0] ?? { totalDebit: 0, totalCredit: 0 };

  res.json({
    rows,
    totals: {
      totalDebit: periodTotals.totalDebit,
      totalCredit: periodTotals.totalCredit,
      balanced: Math.abs(periodTotals.totalDebit - periodTotals.totalCredit) < 0.01,
    },
    nextCursor:
      hasMore && slice.length > 0
        ? encodeTrialBalanceCursor(
            slice[slice.length - 1]!.accountType,
            slice[slice.length - 1]!.accountId,
          )
        : null,
    hasMore,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
}
