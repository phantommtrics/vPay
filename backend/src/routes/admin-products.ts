import type { Response } from 'express';
import {
  CatalogStatus,
  DenominationUnitType,
  ProductUnitType,
} from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { invalidateSettlementCache } from '../settlement/resolver.js';
import { formatZodError } from '../zod-utils.js';

const productCodeSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Code must be lowercase letters, numbers, and hyphens')
  .transform((v) => v.toLowerCase());

const denominationUnitTypeSchema = z.nativeEnum(DenominationUnitType);
const productUnitTypeSchema = z.nativeEnum(ProductUnitType);
const catalogStatusSchema = z.nativeEnum(CatalogStatus);

const dateFieldSchema = z
  .union([z.string().datetime(), z.string().date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    return new Date(value);
  });

const productFieldsSchema = z.object({
  code: productCodeSchema,
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  serviceId: z.string().min(1),
  denominationUnitType: denominationUnitTypeSchema,
  productUnitType: productUnitTypeSchema,
  startDate: dateFieldSchema,
  expiryDate: dateFieldSchema,
  currency: z.string().min(3).max(3).transform((v) => v.toUpperCase()),
  status: catalogStatusSchema.optional(),
  fundHoldingAccountId: z.union([z.string().min(1), z.null()]).optional(),
});

const createProductSchema = productFieldsSchema.superRefine(validateDateRange);
const updateProductSchema = productFieldsSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.startDate !== undefined || data.expiryDate !== undefined) {
      validateDateRange(data as z.infer<typeof productFieldsSchema>, ctx);
    }
  });

const productInclude = {
  service: { select: { id: true, name: true } },
  fundHoldingAccount: { select: { id: true, code: true, name: true, purpose: true, currency: true } },
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

function formatProduct(product: {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  serviceId: string;
  denominationUnitType: DenominationUnitType;
  productUnitType: ProductUnitType;
  startDate: Date | null;
  expiryDate: Date | null;
  currency: string;
  status: CatalogStatus;
  fundHoldingAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
  service: { id: string; name: string };
  fundHoldingAccount: {
    id: string;
    code: string;
    name: string;
    purpose: string;
    currency: string;
  } | null;
}) {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    displayName: product.displayName,
    description: product.description,
    serviceId: product.serviceId,
    service: product.service,
    denominationUnitType: product.denominationUnitType,
    productUnitType: product.productUnitType,
    startDate: product.startDate,
    expiryDate: product.expiryDate,
    currency: product.currency,
    status: product.status,
    fundHoldingAccountId: product.fundHoldingAccountId,
    fundHoldingAccount: product.fundHoldingAccount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function handleListAdminProducts(req: AdminAuthedRequest, res: Response): Promise<void> {
  const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : undefined;

  const products = await prisma.product.findMany({
    where: serviceId ? { serviceId } : undefined,
    include: productInclude,
    orderBy: [{ service: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(products.map(formatProduct));
}

export async function handleGetAdminProduct(req: AdminAuthedRequest, res: Response): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: paramId(req) },
    include: productInclude,
  });

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json(formatProduct(product));
}

export async function handleCreateAdminProduct(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const service = await prisma.service.findUnique({ where: { id: parsed.data.serviceId } });
  if (!service) {
    res.status(400).json({ error: 'Invalid service ID' });
    return;
  }

  if (parsed.data.fundHoldingAccountId) {
    const account = await prisma.businessAccount.findUnique({
      where: { id: parsed.data.fundHoldingAccountId },
    });
    if (!account) {
      res.status(400).json({ error: 'Invalid fund holding account ID' });
      return;
    }
  }

  try {
    const product = await prisma.product.create({
      data: parsed.data,
      include: productInclude,
    });
    invalidateSettlementCache();
    res.status(201).json(formatProduct(product));
  } catch {
    res.status(409).json({ error: 'Product code or name already exists' });
  }
}

export async function handleUpdateAdminProduct(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  if (parsed.data.serviceId) {
    const service = await prisma.service.findUnique({ where: { id: parsed.data.serviceId } });
    if (!service) {
      res.status(400).json({ error: 'Invalid service ID' });
      return;
    }
  }

  if (parsed.data.fundHoldingAccountId) {
    const account = await prisma.businessAccount.findUnique({
      where: { id: parsed.data.fundHoldingAccountId },
    });
    if (!account) {
      res.status(400).json({ error: 'Invalid fund holding account ID' });
      return;
    }
  }

  const existing = await prisma.product.findUnique({ where: { id: paramId(req) } });
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const startDate = parsed.data.startDate !== undefined ? parsed.data.startDate : existing.startDate;
  const expiryDate = parsed.data.expiryDate !== undefined ? parsed.data.expiryDate : existing.expiryDate;
  if (startDate && expiryDate && expiryDate < startDate) {
    res.status(400).json({ error: 'Expiry date must be on or after start date' });
    return;
  }

  try {
    const product = await prisma.product.update({
      where: { id: paramId(req) },
      data: parsed.data,
      include: productInclude,
    });
    invalidateSettlementCache();
    res.json(formatProduct(product));
  } catch {
    res.status(409).json({ error: 'Product code or name already exists' });
  }
}

export async function handleDeleteAdminProduct(req: AdminAuthedRequest, res: Response): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: paramId(req) } });
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  await prisma.product.delete({ where: { id: product.id } });
  invalidateSettlementCache();
  res.status(204).send();
}

export const adminProductsAuthorize = {
  list: authorize('system-config-products', 'view'),
  get: authorize('system-config-products', 'view'),
  create: authorize('system-config-products', 'edit'),
  update: authorize('system-config-products', 'edit'),
  delete: authorize('system-config-products', 'delete'),
};
