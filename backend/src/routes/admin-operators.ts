import type { Response } from 'express';
import { AdminUserStatus, AdminUserType } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../db.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { authorize } from '../middleware/admin-authorize.js';
import { formatZodError } from '../zod-utils.js';

const assignOperatorSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  groupIds: z.array(z.string()).min(1, 'At least one group is required'),
});

const updateOperatorSchema = z.object({
  groupIds: z.array(z.string()).min(1, 'At least one group is required').optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

const operatorInclude = {
  adminGroups: {
    include: {
      group: {
        include: {
          role: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

type OperatorWithGroups = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  adminUserType: AdminUserType | null;
  adminUserStatus: AdminUserStatus;
  adminTotpEnabledAt: Date | null;
  createdAt: Date;
  adminGroups: Array<{
    group: {
      id: string;
      name: string;
      role: { id: string; name: string };
    };
  }>;
};

function paramId(req: AdminAuthedRequest): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0] ?? '';
  return id ?? '';
}

function effectiveRoles(user: OperatorWithGroups) {
  const roleMap = new Map<string, { id: string; name: string }>();
  for (const membership of user.adminGroups) {
    roleMap.set(membership.group.role.id, membership.group.role);
  }
  return [...roleMap.values()];
}

function formatOperator(user: OperatorWithGroups) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.adminUserStatus,
    totpEnrolled: Boolean(user.adminTotpEnabledAt),
    createdAt: user.createdAt,
    roles: effectiveRoles(user),
    groups: user.adminGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  };
}

function operatorWhere() {
  return {
    adminUser: true,
    adminUserType: AdminUserType.OPERATOR,
  };
}

export async function handleListAdminOperators(_req: AdminAuthedRequest, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    where: operatorWhere(),
    include: operatorInclude,
    orderBy: [{ email: 'asc' }],
  });
  res.json(users.map(formatOperator));
}

export async function handleSearchOperatorCandidates(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      adminUser: true,
      adminUserType: true,
    },
    take: 20,
    orderBy: { email: 'asc' },
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isAdmin: u.adminUser,
      adminUserType: u.adminUserType,
    })),
  });
}

export async function handleGetAdminOperator(req: AdminAuthedRequest, res: Response): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: paramId(req), ...operatorWhere() },
    include: operatorInclude,
  });

  if (!user) {
    res.status(404).json({ error: 'Operator not found' });
    return;
  }

  res.json(formatOperator(user));
}

export async function handleAssignAdminOperator(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = assignOperatorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { userId, email, groupIds } = parsed.data;
  if (!userId && !email) {
    res.status(400).json({ error: 'Provide userId or email' });
    return;
  }

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findUnique({ where: { email: email!.toLowerCase() } });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.adminUser && user.adminUserType === AdminUserType.OWNER) {
    res.status(400).json({ error: 'Cannot assign operator access to an owner account' });
    return;
  }

  const groupCount = await prisma.userGroup.count({
    where: { id: { in: groupIds } },
  });
  if (groupCount !== groupIds.length) {
    res.status(400).json({ error: 'Invalid group IDs' });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        adminUser: true,
        adminUserType: AdminUserType.OPERATOR,
        adminUserStatus: AdminUserStatus.ACTIVE,
      },
    });

    await tx.userGroupMember.deleteMany({ where: { userId: user.id } });
    await tx.userGroupMember.createMany({
      data: groupIds.map((groupId) => ({ userId: user.id, groupId })),
    });

    return tx.user.findUnique({
      where: { id: user.id },
      include: operatorInclude,
    });
  });

  res.status(201).json(formatOperator(updated!));
}

export async function handleUpdateAdminOperator(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = updateOperatorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { id: paramId(req), ...operatorWhere() },
  });

  if (!existing) {
    res.status(404).json({ error: 'Operator not found' });
    return;
  }

  const { groupIds, status } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      if (status !== undefined) {
        await tx.user.update({
          where: { id: existing.id },
          data: { adminUserStatus: status as AdminUserStatus },
        });
      }

      if (groupIds !== undefined) {
        const groupCount = await tx.userGroup.count({
          where: { id: { in: groupIds } },
        });
        if (groupCount !== groupIds.length) {
          throw new Error('INVALID_GROUPS');
        }
        await tx.userGroupMember.deleteMany({ where: { userId: existing.id } });
        await tx.userGroupMember.createMany({
          data: groupIds.map((groupId) => ({ userId: existing.id, groupId })),
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_GROUPS') {
      res.status(400).json({ error: 'Invalid group IDs' });
      return;
    }
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: existing.id },
    include: operatorInclude,
  });

  res.json(formatOperator(user!));
}

export async function handleDisableAdminOperator(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id: paramId(req), ...operatorWhere() },
    include: operatorInclude,
  });

  if (!existing) {
    res.status(404).json({ error: 'Operator not found' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { adminUserStatus: AdminUserStatus.DISABLED },
    include: operatorInclude,
  });

  res.json(formatOperator(updated));
}

export async function handleEnableAdminOperator(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id: paramId(req), ...operatorWhere() },
    include: operatorInclude,
  });

  if (!existing) {
    res.status(404).json({ error: 'Operator not found' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { adminUserStatus: AdminUserStatus.ACTIVE },
    include: operatorInclude,
  });

  res.json(formatOperator(updated));
}

export async function handleRevokeAdminOperator(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id: paramId(req), ...operatorWhere() },
  });

  if (!existing) {
    res.status(404).json({ error: 'Operator not found' });
    return;
  }

  await prisma.$transaction([
    prisma.userGroupMember.deleteMany({ where: { userId: existing.id } }),
    prisma.user.update({
      where: { id: existing.id },
      data: {
        adminUser: false,
        adminUserType: null,
        adminUserStatus: AdminUserStatus.ACTIVE,
        adminTotpSecret: null,
        adminTotpEnabledAt: null,
      },
    }),
  ]);

  res.status(204).send();
}

export const adminOperatorsAuthorize = {
  list: authorize('system-config-operators', 'view'),
  search: authorize('system-config-operators', 'edit'),
  get: authorize('system-config-operators', 'view'),
  assign: authorize('system-config-operators', 'edit'),
  update: authorize('system-config-operators', 'edit'),
  disable: authorize('system-config-operators', 'edit'),
  enable: authorize('system-config-operators', 'edit'),
  revoke: authorize('system-config-operators', 'delete'),
};
