import type { Response } from 'express';
import {
  CatalogStatus,
  UcpCalculationType,
  UcpSlabValueType,
  UcpType,
  UcpUnit,
} from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { invalidateSettlementCache } from '../settlement/resolver.js';
import { formatZodError } from '../zod-utils.js';

const ucpCodeSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Code must be lowercase letters, numbers, and hyphens')
  .transform((v) => v.toLowerCase());

const ucpUnitSchema = z.nativeEnum(UcpUnit);
const ucpTypeSchema = z.nativeEnum(UcpType);
const ucpCalculationTypeSchema = z.nativeEnum(UcpCalculationType);
const ucpSlabValueTypeSchema = z.nativeEnum(UcpSlabValueType);
const catalogStatusSchema = z.nativeEnum(CatalogStatus);

const dateFieldSchema = z
  .union([z.string().datetime(), z.string().date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    return new Date(value);
  });

const slabInputSchema = z.object({
  minAmount: z.number().min(0),
  maxAmount: z.number().min(0).nullable().optional(),
  value: z.number(),
  valueType: ucpSlabValueTypeSchema,
  sortOrder: z.number().int().min(0).optional(),
});

const ucpBaseSchema = z.object({
  code: ucpCodeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  unit: ucpUnitSchema,
  ucpType: ucpTypeSchema,
  calculationType: ucpCalculationTypeSchema,
  allowDebitOnSuccessfulTransaction: z.boolean().optional(),
  startDate: dateFieldSchema,
  expiryDate: dateFieldSchema,
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  fixedValue: z.number().nullable().optional(),
  status: catalogStatusSchema.optional(),
  slabs: z.array(slabInputSchema).optional(),
});

const createUcpSchema = ucpBaseSchema.superRefine(validateUcpPayload);
const updateUcpSchema = ucpBaseSchema.partial().superRefine((data, ctx) => {
  if (Object.keys(data).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No fields to update' });
    return;
  }
  validateUcpPayload(data as z.infer<typeof ucpBaseSchema>, ctx);
});

const ucpInclude = {
  slabs: { orderBy: { sortOrder: 'asc' as const } },
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

function validateSlabsArray(slabs: z.infer<typeof slabInputSchema>[]): string | null {
  if (slabs.length === 0) return 'At least one slab tier is required';

  const sorted = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
  for (let i = 0; i < sorted.length; i++) {
    const slab = sorted[i];
    if (slab.maxAmount != null && slab.maxAmount < slab.minAmount) {
      return 'Slab max amount must be greater than or equal to min amount';
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const prevMax = prev.maxAmount ?? prev.minAmount;
      if (slab.minAmount < prevMax) {
        return 'Slab tiers must not overlap';
      }
    }
  }

  return null;
}

function validateSlabs(slabs: z.infer<typeof slabInputSchema>[], ctx: z.RefinementCtx): void {
  const message = validateSlabsArray(slabs);
  if (message) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ['slabs'],
    });
  }
}

function validateUcpPayload(data: z.infer<typeof ucpBaseSchema>, ctx: z.RefinementCtx): void {
  validateDateRange(data, ctx);

  if (data.ucpType === UcpType.FIXED) {
    if (data.fixedValue == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fixed value is required for FIXED UCP type',
        path: ['fixedValue'],
      });
    }
    if (data.slabs && data.slabs.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slabs are not allowed for FIXED UCP type',
        path: ['slabs'],
      });
    }
  }

  if (data.ucpType === UcpType.SLAB) {
    if (data.fixedValue != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fixed value is not allowed for SLAB UCP type',
        path: ['fixedValue'],
      });
    }
    if (data.slabs) {
      validateSlabs(data.slabs, ctx);
    } else if (!('id' in data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slabs are required for SLAB UCP type',
        path: ['slabs'],
      });
    }
  }
}

function formatUcp(ucp: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: UcpUnit;
  ucpType: UcpType;
  calculationType: UcpCalculationType;
  allowDebitOnSuccessfulTransaction: boolean;
  startDate: Date | null;
  expiryDate: Date | null;
  minValue: number | null;
  maxValue: number | null;
  fixedValue: number | null;
  status: CatalogStatus;
  createdAt: Date;
  updatedAt: Date;
  slabs: Array<{
    id: string;
    minAmount: number;
    maxAmount: number | null;
    value: number;
    valueType: UcpSlabValueType;
    sortOrder: number;
  }>;
}) {
  return {
    id: ucp.id,
    code: ucp.code,
    name: ucp.name,
    description: ucp.description,
    unit: ucp.unit,
    ucpType: ucp.ucpType,
    calculationType: ucp.calculationType,
    allowDebitOnSuccessfulTransaction: ucp.allowDebitOnSuccessfulTransaction,
    startDate: ucp.startDate,
    expiryDate: ucp.expiryDate,
    minValue: ucp.minValue,
    maxValue: ucp.maxValue,
    fixedValue: ucp.fixedValue,
    status: ucp.status,
    slabs: ucp.slabs.map((slab) => ({
      id: slab.id,
      minAmount: slab.minAmount,
      maxAmount: slab.maxAmount,
      value: slab.value,
      valueType: slab.valueType,
      sortOrder: slab.sortOrder,
    })),
    createdAt: ucp.createdAt,
    updatedAt: ucp.updatedAt,
  };
}

function normalizeSlabs(slabs: z.infer<typeof slabInputSchema>[]) {
  return [...slabs]
    .sort((a, b) => a.minAmount - b.minAmount)
    .map((slab, index) => ({
      minAmount: slab.minAmount,
      maxAmount: slab.maxAmount ?? null,
      value: slab.value,
      valueType: slab.valueType,
      sortOrder: slab.sortOrder ?? index,
    }));
}

export async function handleListAdminUcps(_req: AdminAuthedRequest, res: Response): Promise<void> {
  const ucps = await prisma.ucp.findMany({
    include: ucpInclude,
    orderBy: { name: 'asc' },
  });
  res.json(ucps.map(formatUcp));
}

export async function handleGetAdminUcp(req: AdminAuthedRequest, res: Response): Promise<void> {
  const ucp = await prisma.ucp.findUnique({
    where: { id: paramId(req) },
    include: ucpInclude,
  });

  if (!ucp) {
    res.status(404).json({ error: 'UCP not found' });
    return;
  }

  res.json(formatUcp(ucp));
}

export async function handleCreateAdminUcp(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = createUcpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { slabs, ...ucpData } = parsed.data;

  if (parsed.data.ucpType === UcpType.SLAB && (!slabs || slabs.length === 0)) {
    res.status(400).json({ error: 'Slabs are required for SLAB UCP type' });
    return;
  }

  try {
    const ucp = await prisma.$transaction(async (tx) => {
      const created = await tx.ucp.create({
        data: {
          ...ucpData,
          fixedValue: parsed.data.ucpType === UcpType.FIXED ? parsed.data.fixedValue ?? null : null,
          slabs:
            parsed.data.ucpType === UcpType.SLAB && slabs
              ? { create: normalizeSlabs(slabs) }
              : undefined,
        },
        include: ucpInclude,
      });
      return created;
    });
    res.status(201).json(formatUcp(ucp));
    invalidateSettlementCache();
  } catch {
    res.status(409).json({ error: 'UCP code or name already exists' });
  }
}

export async function handleUpdateAdminUcp(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = updateUcpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const existing = await prisma.ucp.findUnique({
    where: { id: paramId(req) },
    include: ucpInclude,
  });
  if (!existing) {
    res.status(404).json({ error: 'UCP not found' });
    return;
  }

  const mergedType = parsed.data.ucpType ?? existing.ucpType;
  const mergedStartDate = parsed.data.startDate !== undefined ? parsed.data.startDate : existing.startDate;
  const mergedExpiryDate = parsed.data.expiryDate !== undefined ? parsed.data.expiryDate : existing.expiryDate;
  if (mergedStartDate && mergedExpiryDate && mergedExpiryDate < mergedStartDate) {
    res.status(400).json({ error: 'Expiry date must be on or after start date' });
    return;
  }

  if (mergedType === UcpType.FIXED) {
    const fixedValue = parsed.data.fixedValue !== undefined ? parsed.data.fixedValue : existing.fixedValue;
    if (fixedValue == null) {
      res.status(400).json({ error: 'Fixed value is required for FIXED UCP type' });
      return;
    }
    if (parsed.data.slabs && parsed.data.slabs.length > 0) {
      res.status(400).json({ error: 'Slabs are not allowed for FIXED UCP type' });
      return;
    }
  }

  if (mergedType === UcpType.SLAB) {
    if (parsed.data.fixedValue != null) {
      res.status(400).json({ error: 'Fixed value is not allowed for SLAB UCP type' });
      return;
    }
    if (parsed.data.slabs) {
      const slabCtx = z.array(slabInputSchema).safeParse(parsed.data.slabs);
      if (!slabCtx.success) {
        res.status(400).json({ error: formatZodError(slabCtx.error) });
        return;
      }
      const slabError = validateSlabsArray(slabCtx.data);
      if (slabError) {
        res.status(400).json({ error: slabError });
        return;
      }
    }
  }

  const { slabs, ...ucpData } = parsed.data;

  try {
    const ucp = await prisma.$transaction(async (tx) => {
      if (mergedType === UcpType.FIXED) {
        await tx.ucpSlab.deleteMany({ where: { ucpId: existing.id } });
      }

      if (mergedType === UcpType.SLAB && slabs) {
        await tx.ucpSlab.deleteMany({ where: { ucpId: existing.id } });
      }

      return tx.ucp.update({
        where: { id: existing.id },
        data: {
          ...ucpData,
          fixedValue:
            mergedType === UcpType.FIXED
              ? (parsed.data.fixedValue !== undefined ? parsed.data.fixedValue : existing.fixedValue)
              : null,
          slabs:
            mergedType === UcpType.SLAB && slabs
              ? { create: normalizeSlabs(slabs) }
              : undefined,
        },
        include: ucpInclude,
      });
    });
    res.json(formatUcp(ucp));
    invalidateSettlementCache();
  } catch {
    res.status(409).json({ error: 'UCP code or name already exists' });
  }
}

export async function handleDeleteAdminUcp(req: AdminAuthedRequest, res: Response): Promise<void> {
  const ucp = await prisma.ucp.findUnique({ where: { id: paramId(req) } });
  if (!ucp) {
    res.status(404).json({ error: 'UCP not found' });
    return;
  }

  await prisma.ucp.delete({ where: { id: ucp.id } });
  invalidateSettlementCache();
  res.status(204).send();
}

export const adminUcpsAuthorize = {
  list: authorize('system-config-ucps', 'view'),
  get: authorize('system-config-ucps', 'view'),
  create: authorize('system-config-ucps', 'edit'),
  update: authorize('system-config-ucps', 'edit'),
  delete: authorize('system-config-ucps', 'delete'),
};
