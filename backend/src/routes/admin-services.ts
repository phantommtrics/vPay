import type { Response } from 'express';
import { CatalogStatus, ServiceBehaviour, ServiceType } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { formatZodError } from '../zod-utils.js';

const serviceTypeSchema = z.nativeEnum(ServiceType);
const serviceBehaviourSchema = z.nativeEnum(ServiceBehaviour);
const catalogStatusSchema = z.nativeEnum(CatalogStatus);

const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: serviceTypeSchema,
  behaviour: serviceBehaviourSchema,
  status: catalogStatusSchema.optional(),
});

const updateServiceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: serviceTypeSchema.optional(),
  behaviour: serviceBehaviourSchema.optional(),
  status: catalogStatusSchema.optional(),
});

const serviceInclude = {
  _count: { select: { products: true } },
} as const;

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

function formatService(service: {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  behaviour: ServiceBehaviour;
  status: CatalogStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: { products: number };
}) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    type: service.type,
    behaviour: service.behaviour,
    status: service.status,
    productCount: service._count.products,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

export async function handleListAdminServices(_req: AdminAuthedRequest, res: Response): Promise<void> {
  const services = await prisma.service.findMany({
    include: serviceInclude,
    orderBy: { name: 'asc' },
  });
  res.json(services.map(formatService));
}

export async function handleGetAdminService(req: AdminAuthedRequest, res: Response): Promise<void> {
  const service = await prisma.service.findUnique({
    where: { id: paramId(req) },
    include: serviceInclude,
  });

  if (!service) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }

  res.json(formatService(service));
}

export async function handleCreateAdminService(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const service = await prisma.service.create({
      data: parsed.data,
      include: serviceInclude,
    });
    res.status(201).json(formatService(service));
  } catch {
    res.status(409).json({ error: 'Service name already exists' });
  }
}

export async function handleUpdateAdminService(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const service = await prisma.service.update({
      where: { id: paramId(req) },
      data: parsed.data,
      include: serviceInclude,
    });
    res.json(formatService(service));
  } catch {
    res.status(404).json({ error: 'Service not found' });
  }
}

export async function handleDeleteAdminService(req: AdminAuthedRequest, res: Response): Promise<void> {
  const service = await prisma.service.findUnique({
    where: { id: paramId(req) },
    include: { _count: { select: { products: true } } },
  });

  if (!service) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  if (service._count.products > 0) {
    res.status(409).json({ error: 'Service has products and cannot be deleted' });
    return;
  }

  await prisma.service.delete({ where: { id: service.id } });
  res.status(204).send();
}

export const adminServicesAuthorize = {
  list: authorize('system-config-services', 'view'),
  get: authorize('system-config-services', 'view'),
  create: authorize('system-config-services', 'edit'),
  update: authorize('system-config-services', 'edit'),
  delete: authorize('system-config-services', 'delete'),
};
