import type { Response } from 'express';
import { z } from 'zod';

import { ACTIONS, MODULES, actionsForModule, getModuleActionsMap } from '../admin/permissions.js';
import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize, authorizeAny } from '../middleware/admin-authorize.js';
import { formatZodError } from '../zod-utils.js';

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

const setPermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
});

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

export async function handleAdminPermissionsCatalog(
  _req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
  });

  res.json({
    modules: [...MODULES],
    actions: [...ACTIONS],
    moduleActions: getModuleActionsMap(),
    permissions,
  });
}

export async function handleListAdminRoles(_req: AdminAuthedRequest, res: Response): Promise<void> {
  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { users: true, permissions: true, groups: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      userCount: r._count.users,
      groupCount: r._count.groups,
      permissionCount: r._count.permissions,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}

export async function handleGetAdminRole(req: AdminAuthedRequest, res: Response): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id: paramId(req) },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true, groups: true } },
    },
  });

  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }

  res.json({
    id: role.id,
    name: role.name,
    description: role.description,
    userCount: role._count.users,
    groupCount: role._count.groups,
    permissionIds: role.permissions.map((rp) => rp.permissionId),
    permissions: role.permissions.map((rp) => rp.permission),
  });
}

export async function handleCreateAdminRole(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const role = await prisma.role.create({ data: parsed.data });
    res.status(201).json(role);
  } catch {
    res.status(409).json({ error: 'Role name already exists' });
  }
}

export async function handleUpdateAdminRole(req: AdminAuthedRequest, res: Response): Promise<void> {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  try {
    const role = await prisma.role.update({
      where: { id: paramId(req) },
      data: parsed.data,
    });
    res.json(role);
  } catch {
    res.status(404).json({ error: 'Role not found' });
  }
}

export async function handleSetAdminRolePermissions(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = setPermissionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const role = await prisma.role.findUnique({ where: { id: paramId(req) } });
  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }

  const validCount = await prisma.permission.count({
    where: { id: { in: parsed.data.permissionIds } },
  });
  if (validCount !== parsed.data.permissionIds.length) {
    res.status(400).json({ error: 'One or more permission IDs are invalid' });
    return;
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: parsed.data.permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
    }),
  ]);

  const updated = await prisma.role.findUnique({
    where: { id: role.id },
    include: { permissions: { include: { permission: true } } },
  });

  res.json({
    id: updated!.id,
    permissionIds: updated!.permissions.map((rp) => rp.permissionId),
  });
}

export async function handleDeleteAdminRole(req: AdminAuthedRequest, res: Response): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id: paramId(req) },
    include: { _count: { select: { users: true, groups: true } } },
  });

  if (!role) {
    res.status(404).json({ error: 'Role not found' });
    return;
  }
  if (role.name === 'Owner') {
    res.status(400).json({ error: 'Cannot delete the Owner role' });
    return;
  }
  if (role._count.users > 0 || role._count.groups > 0) {
    res.status(400).json({ error: 'Role is in use and cannot be deleted' });
    return;
  }

  await prisma.role.delete({ where: { id: role.id } });
  res.status(204).send();
}

export const adminRolesAuthorize = {
  catalog: authorize('system-config-roles', 'view'),
  list: authorizeAny([
    ['system-config-roles', 'view'],
    ['system-config-groups', 'edit'],
  ]),
  get: authorize('system-config-roles', 'view'),
  create: authorize('system-config-roles', 'edit'),
  update: authorize('system-config-roles', 'edit'),
  setPermissions: authorize('system-config-roles', 'edit'),
  delete: authorize('system-config-roles', 'delete'),
};

export async function ensureAdminPermissionsSeeded(): Promise<void> {
  for (const moduleKey of MODULES) {
    for (const actionKey of actionsForModule(moduleKey)) {
      await prisma.permission.upsert({
        where: { moduleKey_actionKey: { moduleKey, actionKey } },
        update: {
          name: `${moduleKey}:${actionKey}`,
          description: `${actionKey} permission for ${moduleKey}`,
        },
        create: {
          moduleKey,
          actionKey,
          name: `${moduleKey}:${actionKey}`,
          description: `${actionKey} permission for ${moduleKey}`,
        },
      });
    }
  }
}
