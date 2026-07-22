import {
  AccountStatus,
  FundingOrderStatus,
  VirtualCardStatus,
  type User,
} from '@prisma/client';

import { isVirtualCardActive } from '../card-expiry.js';
import { listUserCards, prisma, updateVirtualCardStatus } from '../db.js';
import { log } from '../logger.js';
import { updateCardStatus } from '../stripe/issuing.js';
import { getWalletForUser } from '../wallet/service.js';

export const ACCOUNT_DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';

export class AccountTerminateError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AccountTerminateError';
  }
}

function terminatedEmailForUser(userId: string): string {
  return `terminated+${userId}@deleted.vpay.local`;
}

function terminatedWalletPhoneForUser(userId: string): string {
  return `terminated:${userId}`;
}

async function freezeActiveCards(user: User): Promise<void> {
  const cards = await listUserCards(user.id);

  for (const card of cards) {
    if (card.status !== VirtualCardStatus.ACTIVE) {
      continue;
    }
    if (!isVirtualCardActive(card)) {
      continue;
    }

    try {
      await updateCardStatus(card.stripeCardId, user.stripeConnectedAccountId, 'inactive');
      await updateVirtualCardStatus(card.id, VirtualCardStatus.INACTIVE);
    } catch (err) {
      log('Failed to freeze card during account termination', {
        userId: user.id,
        cardId: card.id,
        error: err instanceof Error ? err.message : 'unknown',
      });
      throw new AccountTerminateError(
        'Unable to freeze your virtual card. Please try again or contact support.',
        502,
        'CARD_FREEZE_FAILED',
      );
    }
  }
}

export async function terminateAccount(
  userId: string,
  confirmation: string,
): Promise<void> {
  if (confirmation.trim() !== ACCOUNT_DELETE_CONFIRMATION) {
    throw new AccountTerminateError(
      `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`,
      400,
      'CONFIRMATION_REQUIRED',
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AccountTerminateError('User not found', 404);
  }

  if (user.accountStatus === AccountStatus.TERMINATED) {
    throw new AccountTerminateError('Account is already terminated', 410, 'ALREADY_TERMINATED');
  }

  if (user.adminUser) {
    throw new AccountTerminateError(
      'Admin accounts cannot be deleted from the mobile app',
      403,
      'ADMIN_ACCOUNT',
    );
  }

  const wallet = await getWalletForUser(userId);
  if (wallet && wallet.balanceGmd > 0) {
    throw new AccountTerminateError(
      'Your vPay wallet balance must be zero before you can delete your account. Spend the remaining balance (for example by funding your card) or contact support.',
      409,
      'WALLET_BALANCE_NOT_ZERO',
      { balanceGmd: wallet.balanceGmd },
    );
  }

  // Freeze cards before rewriting identity so a Stripe failure leaves the account usable.
  await freezeActiveCards(user);

  const now = new Date();
  const rewrittenEmail = terminatedEmailForUser(user.id);
  const rewrittenWalletPhone = terminatedWalletPhoneForUser(user.id);

  await prisma.$transaction(async (tx) => {
    await tx.fundingOrder.updateMany({
      where: { userId: user.id, status: FundingOrderStatus.PENDING },
      data: { status: FundingOrderStatus.CANCELLED },
    });

    await tx.vPayWallet.updateMany({
      where: { userId: user.id },
      data: { phoneNumber: rewrittenWalletPhone },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        accountStatus: AccountStatus.TERMINATED,
        terminatedAt: now,
        originalEmail: user.email,
        email: rewrittenEmail,
        phone: null,
        phoneE164: null,
        deviceLockEnabled: false,
        lockedDeviceId: null,
      },
    });
  });

  log('User account terminated', { userId: user.id, originalEmail: user.email });
}
