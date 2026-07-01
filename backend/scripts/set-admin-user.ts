import 'dotenv/config';

import { AdminUserType } from '@prisma/client';

import { findUserByEmail, prisma } from '../src/db.js';

async function main(): Promise<void> {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) {
    console.error('Usage: npx tsx scripts/set-admin-user.ts <email>');
    process.exit(1);
  }

  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`No user found for email: ${email}`);
    process.exit(1);
  }

  if (user.adminUser && user.adminUserType === AdminUserType.OWNER) {
    console.log(`Already an owner admin: ${email} (${user.id})`);
    return;
  }

  const ownerRole = await prisma.role.findUnique({ where: { name: 'Owner' } });
  if (!ownerRole) {
    console.error('Owner role not found. Run: npx tsx scripts/seed-admin-permissions.ts');
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        adminUser: true,
        adminUserType: AdminUserType.OWNER,
      },
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: user.id, roleId: ownerRole.id },
    }),
    prisma.userGroupMember.deleteMany({ where: { userId: user.id } }),
  ]);

  console.log(`Owner admin access granted: ${email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
