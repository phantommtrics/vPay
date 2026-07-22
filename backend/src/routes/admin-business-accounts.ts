import type { Response } from 'express';
import { BusinessAccountPurpose, CatalogStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { resolveBoundedReportDateRange } from '../reports/date-range.js';
import { nextCursorFromItems, parseReportLimit } from '../reports/pagination.js';
import { formatZodError } from '../zod-utils.js';

const purposeSchema = z.nativeEnum(BusinessAccountPurpose);
const catalogStatusSchema = z.nativeEnum(CatalogStatus);

const accountCodeSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Code must be lowercase letters, numbers, and hyphens')
  .transform((v) => v.toLowerCase());

const createAccountSchema = z.object({
  entityId: z.string().min(1),
  code: accountCodeSchema,
  name: z.string().min(1).max(100),
  currency: z.string().min(3).max(3).transform((v) => v.toUpperCase()),
  purpose: purposeSchema,
  status: catalogStatusSchema.optional(),
});

const updateAccountSchema = z.object({
  code: accountCodeSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  currency: z.string().min(3).max(3).transform((v) => v.toUpperCase()).optional(),
  purpose: purposeSchema.optional(),
  status: catalogStatusSchema.optional(),
});

const accountInclude = {
  entity: { select: { id: true, code: true, name: true, type: true } },
} as const;

const transactionQuerySchema = z.object({
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

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

function formatAccount(account: {
  id: string;
  entityId: string;
  code: string;
  name: string;
  currency: string;
  purpose: BusinessAccountPurpose;
  balance: number;
  status: CatalogStatus;
  createdAt: Date;
  updatedAt: Date;
  entity: { id: string; code: string; name: string; type: string };
}) {
  return {
    id: account.id,
    entityId: account.entityId,
    code: account.code,
    name: account.name,
    currency: account.currency,
    purpose: account.purpose,
    balance: account.balance,
    status: account.status,
    entity: account.entity,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function formatAccountTransaction(row: {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  productCode: string | null;
  ucpCode: string | null;
  description: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    amount: row.amount,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    productCode: row.productCode,
    ucpCode: row.ucpCode,
    description: row.description,
    createdAt: row.createdAt,
  };
}

export async function handleListAdminBusinessAccounts(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  const purpose =
    typeof req.query.purpose === 'string' ? (req.query.purpose as BusinessAccountPurpose) : undefined;

  const rows = await prisma.businessAccount.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(purpose ? { purpose } : {}),
    },
    include: accountInclude,
    orderBy: [{ entity: { name: 'asc' } }, { name: 'asc' }],
  });

  res.json(rows.map(formatAccount));
}

export async function handleGetAdminBusinessAccount(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const row = await prisma.businessAccount.findUnique({
    where: { id: paramId(req) },
    include: accountInclude,
  });

  if (!row) {
    res.status(404).json({ error: 'Business account not found' });
    return;
  }

  res.json(formatAccount(row));
}

export async function handleCreateAdminBusinessAccount(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const entity = await prisma.businessEntity.findUnique({ where: { id: parsed.data.entityId } });
  if (!entity) {
    res.status(400).json({ error: 'Invalid business entity ID' });
    return;
  }

  try {
    const row = await prisma.businessAccount.create({
      data: parsed.data,
      include: accountInclude,
    });
    res.status(201).json(formatAccount(row));
  } catch {
    res.status(409).json({ error: 'Account code already exists for this entity' });
  }
}

export async function handleUpdateAdminBusinessAccount(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = updateAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const row = await prisma.businessAccount.update({
      where: { id: paramId(req) },
      data: parsed.data,
      include: accountInclude,
    });
    res.json(formatAccount(row));
  } catch {
    res.status(404).json({ error: 'Business account not found' });
  }
}

export async function handleDeleteAdminBusinessAccount(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const row = await prisma.businessAccount.findUnique({
    where: { id: paramId(req) },
    include: {
      _count: {
        select: {
          fundHoldingProducts: true,
          feeDestinationSettlements: true,
          transactions: true,
        },
      },
    },
  });

  if (!row) {
    res.status(404).json({ error: 'Business account not found' });
    return;
  }

  if (row._count.fundHoldingProducts > 0 || row._count.feeDestinationSettlements > 0) {
    res.status(409).json({ error: 'Account is referenced by products or settlements and cannot be deleted' });
    return;
  }
  if (row._count.transactions > 0) {
    res.status(409).json({ error: 'Account has transactions and cannot be deleted' });
    return;
  }

  await prisma.businessAccount.delete({ where: { id: row.id } });
  res.status(204).send();
}

export async function handleListAdminBusinessAccountTransactions(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const accountId = paramId(req);
  const account = await prisma.businessAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    res.status(404).json({ error: 'Business account not found' });
    return;
  }

  const parsed = transactionQuerySchema.safeParse(req.query);
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

  const rows = await prisma.businessAccountTransaction.findMany({
    where: {
      accountId,
      createdAt: dateRange.filter,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    items: items.map(formatAccountTransaction),
    nextCursor: nextCursorFromItems(items, hasMore, (item) => item.id),
    hasMore,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
}

export const adminBusinessAccountsAuthorize = {
  list: authorize('system-config-business-entities', 'view'),
  get: authorize('system-config-business-entities', 'view'),
  create: authorize('system-config-business-entities', 'edit'),
  update: authorize('system-config-business-entities', 'edit'),
  delete: authorize('system-config-business-entities', 'delete'),
  transactions: authorize('system-config-business-entities', 'view'),
};
