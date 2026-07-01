import 'dotenv/config';

import { AdminUserType } from '@prisma/client';

import { MODULES, actionsForModule } from '../src/admin/permissions.js';
import { prisma } from '../src/db.js';

async function main(): Promise<void> {
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

  const ownerRole = await prisma.role.upsert({
    where: { name: 'Owner' },
    update: {},
    create: { name: 'Owner', description: 'Full system access' },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({ where: { roleId: ownerRole.id } });
  if (allPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({
        roleId: ownerRole.id,
        permissionId: p.id,
      })),
    });
  }

  const owners = await prisma.user.findMany({
    where: { adminUser: true, adminUserType: AdminUserType.OWNER },
    select: { id: true, email: true },
  });

  for (const owner of owners) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: owner.id, roleId: ownerRole.id },
    });
  }

  console.log(`Seeded ${allPermissions.length} permissions`);
  console.log(`Owner role linked to ${owners.length} owner account(s)`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
