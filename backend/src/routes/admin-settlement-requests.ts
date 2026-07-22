import type { Response } from 'express';
import { CatalogStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { invalidateSettlementCache } from '../settlement/resolver.js';
import { formatZodError } from '../zod-utils.js';

const catalogStatusSchema = z.nativeEnum(CatalogStatus);

const dateFieldSchema = z
  .union([z.string().datetime(), z.string().date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    return new Date(value);
  });

const settlementFieldsSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  productId: z.string().min(1),
  ucpId: z.string().min(1),
  priority: z.number().int().min(0).optional(),
  startDate: dateFieldSchema,
  expiryDate: dateFieldSchema,
  status: catalogStatusSchema.optional(),
  feeDestinationAccountId: z.union([z.string().min(1), z.null()]).optional(),
});

const createSettlementSchema = settlementFieldsSchema.superRefine(validateDateRange);
const updateSettlementSchema = settlementFieldsSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.startDate !== undefined || data.expiryDate !== undefined) {
      validateDateRange(data as z.infer<typeof settlementFieldsSchema>, ctx);
    }
  });

const settlementInclude = {
  product: { select: { id: true, code: true, name: true, displayName: true, currency: true } },
  ucp: { select: { id: true, code: true, name: true, unit: true, ucpType: true } },
  feeDestinationAccount: {
    select: { id: true, code: true, name: true, purpose: true, currency: true },
  },
} as const;

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

function validateDateRange(
  data: { startDate?: Date | null; expiryDate?: Date | null },
  ctx: z.RefinementCtx,
): void {
  if (data.startDate && data.expiryDate && data.expiryDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expiry date must be on or after start date',
      path: ['expiryDate'],
    });
  }
}

function formatSettlement(row: {
  id: string;
  name: string;
  description: string | null;
  productId: string;
  ucpId: string;
  priority: number;
  startDate: Date | null;
  expiryDate: Date | null;
  status: CatalogStatus;
  feeDestinationAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: { id: string; code: string; name: string; displayName: string; currency: string };
  ucp: { id: string; code: string; name: string; unit: string; ucpType: string };
  feeDestinationAccount: {
    id: string;
    code: string;
    name: string;
    purpose: string;
    currency: string;
  } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    productId: row.productId,
    ucpId: row.ucpId,
    priority: row.priority,
    startDate: row.startDate,
    expiryDate: row.expiryDate,
    status: row.status,
    feeDestinationAccountId: row.feeDestinationAccountId,
    feeDestinationAccount: row.feeDestinationAccount,
    product: row.product,
    ucp: row.ucp,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function handleListAdminSettlementRequests(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;

  const rows = await prisma.settlementRequest.findMany({
    where: productId ? { productId } : undefined,
    include: settlementInclude,
    orderBy: [{ product: { name: 'asc' } }, { priority: 'asc' }, { name: 'asc' }],
  });

  res.json(rows.map(formatSettlement));
}

export async function handleGetAdminSettlementRequest(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const row = await prisma.settlementRequest.findUnique({
    where: { id: paramId(req) },
    include: settlementInclude,
  });

  if (!row) {
    res.status(404).json({ error: 'Settlement request not found' });
    return;
  }

  res.json(formatSettlement(row));
}

export async function handleCreateAdminSettlementRequest(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = createSettlementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const [product, ucp] = await Promise.all([
    prisma.product.findUnique({ where: { id: parsed.data.productId } }),
    prisma.ucp.findUnique({ where: { id: parsed.data.ucpId } }),
  ]);

  if (!product) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }
  if (!ucp) {
    res.status(400).json({ error: 'Invalid UCP ID' });
    return;
  }

  if (parsed.data.feeDestinationAccountId) {
    const account = await prisma.businessAccount.findUnique({
      where: { id: parsed.data.feeDestinationAccountId },
    });
    if (!account) {
      res.status(400).json({ error: 'Invalid fee destination account ID' });
      return;
    }
  }

  try {
    const row = await prisma.settlementRequest.create({
      data: parsed.data,
      include: settlementInclude,
    });
    invalidateSettlementCache();
    res.status(201).json(formatSettlement(row));
  } catch {
    res.status(409).json({ error: 'This product and UCP are already linked' });
  }
}

export async function handleUpdateAdminSettlementRequest(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = updateSettlementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const existing = await prisma.settlementRequest.findUnique({ where: { id: paramId(req) } });
  if (!existing) {
    res.status(404).json({ error: 'Settlement request not found' });
    return;
  }

  if (parsed.data.productId) {
    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
    if (!product) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
  }
  if (parsed.data.ucpId) {
    const ucp = await prisma.ucp.findUnique({ where: { id: parsed.data.ucpId } });
    if (!ucp) {
      res.status(400).json({ error: 'Invalid UCP ID' });
      return;
    }
  }

  if (parsed.data.feeDestinationAccountId) {
    const account = await prisma.businessAccount.findUnique({
      where: { id: parsed.data.feeDestinationAccountId },
    });
    if (!account) {
      res.status(400).json({ error: 'Invalid fee destination account ID' });
      return;
    }
  }

  const startDate = parsed.data.startDate !== undefined ? parsed.data.startDate : existing.startDate;
  const expiryDate = parsed.data.expiryDate !== undefined ? parsed.data.expiryDate : existing.expiryDate;
  if (startDate && expiryDate && expiryDate < startDate) {
    res.status(400).json({ error: 'Expiry date must be on or after start date' });
    return;
  }

  try {
    const row = await prisma.settlementRequest.update({
      where: { id: existing.id },
      data: parsed.data,
      include: settlementInclude,
    });
    invalidateSettlementCache();
    res.json(formatSettlement(row));
  } catch {
    res.status(409).json({ error: 'This product and UCP combination already exists' });
  }
}

export async function handleDeleteAdminSettlementRequest(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const row = await prisma.settlementRequest.findUnique({ where: { id: paramId(req) } });
  if (!row) {
    res.status(404).json({ error: 'Settlement request not found' });
    return;
  }

  await prisma.settlementRequest.delete({ where: { id: row.id } });
  invalidateSettlementCache();
  res.status(204).send();
}

export const adminSettlementRequestsAuthorize = {
  list: authorize('system-config-settlements', 'view'),
  get: authorize('system-config-settlements', 'view'),
  create: authorize('system-config-settlements', 'edit'),
  update: authorize('system-config-settlements', 'edit'),
  delete: authorize('system-config-settlements', 'delete'),
};
