import type { Response } from 'express';
import { BusinessEntityType, CatalogStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { formatZodError } from '../zod-utils.js';

const entityTypeSchema = z.nativeEnum(BusinessEntityType);
const catalogStatusSchema = z.nativeEnum(CatalogStatus);

const entityCodeSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'Code must be lowercase letters, numbers, and hyphens')
  .transform((v) => v.toLowerCase());

const createEntitySchema = z.object({
  code: entityCodeSchema,
  name: z.string().min(1).max(100),
  type: entityTypeSchema,
  description: z.string().max(500).optional(),
  status: catalogStatusSchema.optional(),
});

const updateEntitySchema = z.object({
  code: entityCodeSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  type: entityTypeSchema.optional(),
  description: z.string().max(500).optional().nullable(),
  status: catalogStatusSchema.optional(),
});

const entityInclude = {
  _count: { select: { accounts: true } },
} as const;

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

function formatEntity(entity: {
  id: string;
  code: string;
  name: string;
  type: BusinessEntityType;
  description: string | null;
  status: CatalogStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: { accounts: number };
}) {
  return {
    id: entity.id,
    code: entity.code,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    status: entity.status,
    accountCount: entity._count.accounts,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export async function handleListAdminBusinessEntities(
  _req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const rows = await prisma.businessEntity.findMany({
    include: entityInclude,
    orderBy: { name: 'asc' },
  });
  res.json(rows.map(formatEntity));
}

export async function handleGetAdminBusinessEntity(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const row = await prisma.businessEntity.findUnique({
    where: { id: paramId(req) },
    include: entityInclude,
  });

  if (!row) {
    res.status(404).json({ error: 'Business entity not found' });
    return;
  }

  res.json(formatEntity(row));
}

export async function handleCreateAdminBusinessEntity(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = createEntitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const row = await prisma.businessEntity.create({
      data: parsed.data,
      include: entityInclude,
    });
    res.status(201).json(formatEntity(row));
  } catch {
    res.status(409).json({ error: 'Business entity code already exists' });
  }
}

export async function handleUpdateAdminBusinessEntity(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = updateEntitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const row = await prisma.businessEntity.update({
      where: { id: paramId(req) },
      data: parsed.data,
      include: entityInclude,
    });
    res.json(formatEntity(row));
  } catch {
    res.status(404).json({ error: 'Business entity not found' });
  }
}

export async function handleDeleteAdminBusinessEntity(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const row = await prisma.businessEntity.findUnique({
    where: { id: paramId(req) },
    include: { _count: { select: { accounts: true } } },
  });

  if (!row) {
    res.status(404).json({ error: 'Business entity not found' });
    return;
  }
  if (row._count.accounts > 0) {
    res.status(409).json({ error: 'Business entity has accounts and cannot be deleted' });
    return;
  }

  await prisma.businessEntity.delete({ where: { id: row.id } });
  res.status(204).send();
}

export const adminBusinessEntitiesAuthorize = {
  list: authorize('system-config-business-entities', 'view'),
  get: authorize('system-config-business-entities', 'view'),
  create: authorize('system-config-business-entities', 'edit'),
  update: authorize('system-config-business-entities', 'edit'),
  delete: authorize('system-config-business-entities', 'delete'),
};
