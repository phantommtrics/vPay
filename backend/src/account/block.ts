import { AccountStatus, FundingOrderStatus, type User } from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import { freezeActiveCards } from './terminate.js';

export class AccountBlockError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'AccountBlockError';
  }
}

async function loadCustomer(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AccountBlockError('User not found', 404);
  }
  if (user.adminUser) {
    throw new AccountBlockError(
      'Admin operator accounts cannot be blocked from customer management',
      403,
      'ADMIN_ACCOUNT',
    );
  }
  return user;
}

export async function blockAccount(
  userId: string,
  opts: { adminUserId?: string | null; reason?: string | null } = {},
): Promise<User> {
  const user = await loadCustomer(userId);

  if (user.accountStatus === AccountStatus.TERMINATED) {
    throw new AccountBlockError('Terminated accounts cannot be blocked', 410, 'ALREADY_TERMINATED');
  }

  if (user.accountStatus === AccountStatus.BLOCKED) {
    throw new AccountBlockError('Account is already blocked', 409, 'ALREADY_BLOCKED');
  }

  await freezeActiveCards(user, { requireStripeSuccess: false });

  const now = new Date();
  const reason = opts.reason?.trim() || null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.fundingOrder.updateMany({
      where: { userId: user.id, status: FundingOrderStatus.PENDING },
      data: { status: FundingOrderStatus.CANCELLED },
    });

    return tx.user.update({
      where: { id: user.id },
      data: {
        accountStatus: AccountStatus.BLOCKED,
        blockedAt: now,
        blockedReason: reason,
      },
    });
  });

  log('Customer account blocked', {
    userId: user.id,
    adminUserId: opts.adminUserId ?? null,
    reason,
  });

  return updated;
}

export async function unblockAccount(
  userId: string,
  opts: { adminUserId?: string | null } = {},
): Promise<User> {
  const user = await loadCustomer(userId);

  if (user.accountStatus === AccountStatus.TERMINATED) {
    throw new AccountBlockError('Terminated accounts cannot be reactivated', 410, 'ALREADY_TERMINATED');
  }

  if (user.accountStatus !== AccountStatus.BLOCKED) {
    throw new AccountBlockError('Account is not blocked', 409, 'NOT_BLOCKED');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      accountStatus: AccountStatus.ACTIVE,
      blockedAt: null,
      blockedReason: null,
    },
  });

  log('Customer account unblocked', {
    userId: user.id,
    adminUserId: opts.adminUserId ?? null,
  });

  return updated;
}
