import type { Response } from 'express';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize, authorizeAny } from '../middleware/admin-authorize.js';
import { formatZodError } from '../zod-utils.js';

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  roleId: z.string().min(1),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  roleId: z.string().min(1).optional(),
});

const groupInclude = {
  role: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} as const;

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

function formatGroup(group: {
  id: string;
  name: string;
  description: string | null;
  roleId: string;
  role: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
  _count: { members: number };
}) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    roleId: group.roleId,
    role: group.role,
    memberCount: group._count.members,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export async function handleListAdminGroups(_req: AdminAuthedRequest, res: Response): Promise<void> {
  const groups = await prisma.userGroup.findMany({
    include: groupInclude,
    orderBy: { name: 'asc' },
  });
  res.json(groups.map(formatGroup));
}

export async function handleGetAdminGroup(req: AdminAuthedRequest, res: Response): Promise<void> {
  const group = await prisma.userGroup.findUnique({
    where: { id: paramId(req) },
    include: groupInclude,
  });

  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  res.json(formatGroup(group));
}

export async function handleCreateAdminGroup(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
  if (!role) {
    res.status(400).json({ error: 'Invalid role ID' });
    return;
  }

  try {
    const group = await prisma.userGroup.create({
      data: parsed.data,
      include: groupInclude,
    });
    res.status(201).json(formatGroup(group));
  } catch {
    res.status(409).json({ error: 'Group name already exists' });
  }
}

export async function handleUpdateAdminGroup(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = updateGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  if (parsed.data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
    if (!role) {
      res.status(400).json({ error: 'Invalid role ID' });
      return;
    }
  }

  try {
    const group = await prisma.userGroup.update({
      where: { id: paramId(req) },
      data: parsed.data,
      include: groupInclude,
    });
    res.json(formatGroup(group));
  } catch {
    res.status(404).json({ error: 'Group not found' });
  }
}

export async function handleDeleteAdminGroup(req: AdminAuthedRequest, res: Response): Promise<void> {
  const group = await prisma.userGroup.findUnique({
    where: { id: paramId(req) },
    include: { _count: { select: { members: true } } },
  });

  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  if (group._count.members > 0) {
    res.status(400).json({ error: 'Group has members and cannot be deleted' });
    return;
  }

  await prisma.userGroup.delete({ where: { id: group.id } });
  res.status(204).send();
}

export const adminGroupsAuthorize = {
  list: authorizeAny([
    ['system-config-groups', 'view'],
    ['system-config-operators', 'view'],
    ['system-config-operators', 'edit'],
  ]),
  get: authorize('system-config-groups', 'view'),
  create: authorize('system-config-groups', 'edit'),
  update: authorize('system-config-groups', 'edit'),
  delete: authorize('system-config-groups', 'delete'),
};
