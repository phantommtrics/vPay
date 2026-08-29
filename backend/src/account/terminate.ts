import {
  AccountStatus,
  FundingOrderStatus,
  VirtualCardStatus,
  WalletTransactionType,
  type User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { isVirtualCardActive } from '../card-expiry.js';
import {
  resolveFeeDestinationAccount,
  resolveFundHoldingAccount,
} from '../business-accounts/service.js';
import { listUserCards, prisma, updateVirtualCardStatus } from '../db.js';
import { postAccountTerminationJournal } from '../journal/service.js';
import { log } from '../logger.js';
import {
  PRODUCT_CODES,
  UCP_CODES,
} from '../settlement/catalog-codes.js';
import { updateCardStatus } from '../stripe/issuing.js';
import { debitWallet, getWalletForUser } from '../wallet/service.js';

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

export async function freezeActiveCards(
  user: User,
  opts: { requireStripeSuccess?: boolean; stripeTimeoutMs?: number } = {},
): Promise<void> {
  const requireStripeSuccess = opts.requireStripeSuccess !== false;
  const stripeTimeoutMs = opts.stripeTimeoutMs ?? (requireStripeSuccess ? 60_000 : 8_000);
  const cards = await listUserCards(user.id);

  for (const card of cards) {
    if (card.status !== VirtualCardStatus.ACTIVE) {
      continue;
    }
    if (!isVirtualCardActive(card)) {
      continue;
    }

    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          updateCardStatus(card.stripeCardId, user.stripeConnectedAccountId, 'inactive'),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error(`Stripe card freeze timed out after ${stripeTimeoutMs}ms`)),
              stripeTimeoutMs,
            );
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      await updateVirtualCardStatus(card.id, VirtualCardStatus.INACTIVE);
    } catch (err) {
      log('Failed to freeze card during account termination', {
        userId: user.id,
        cardId: card.id,
        error: err instanceof Error ? err.message : 'unknown',
        requireStripeSuccess,
      });

      if (requireStripeSuccess) {
        throw new AccountTerminateError(
          'Unable to freeze virtual card(s). Please try again or contact support.',
          502,
          'CARD_FREEZE_FAILED',
        );
      }

      // Admin paths: still freeze locally so block/terminate can complete offline from Stripe.
      await updateVirtualCardStatus(card.id, VirtualCardStatus.INACTIVE);
    }
  }
}

async function applyTermination(
  user: User,
  opts: { requireStripeSuccess?: boolean } = {},
): Promise<void> {
  // Freeze cards before rewriting identity so a Stripe failure leaves the account usable
  // when Stripe success is required (mobile self-serve delete).
  await freezeActiveCards(user, opts);

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
        blockedAt: null,
        blockedReason: null,
        originalEmail: user.originalEmail ?? user.email,
        email: rewrittenEmail,
        phone: null,
        phoneE164: null,
        deviceLockEnabled: false,
        lockedDeviceId: null,
        appLockType: null,
        appLockSecretHash: null,
        appLockFailedAttempts: 0,
        appLockLockedUntil: null,
      },
    });
  });
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

  await applyTermination(user);
  log('User account terminated', { userId: user.id, originalEmail: user.email });
}

/**
 * Admin: zero remaining wallet balance (ledgered ADJUSTMENT), then soft-terminate
 * the customer account the same way self-serve delete does.
 */
export async function adminTerminateAccount(
  userId: string,
  opts: { adminUserId?: string | null; reason?: string | null } = {},
): Promise<{ zeroedBalanceGmd: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AccountTerminateError('User not found', 404);
  }

  if (user.accountStatus === AccountStatus.TERMINATED) {
    throw new AccountTerminateError('Account is already terminated', 410, 'ALREADY_TERMINATED');
  }

  if (user.adminUser) {
    throw new AccountTerminateError(
      'Admin operator accounts cannot be terminated from customer management',
      403,
      'ADMIN_ACCOUNT',
    );
  }

  const wallet = await getWalletForUser(userId);
  let zeroedBalanceGmd = 0;

  if (wallet && wallet.balanceGmd > 0) {
    zeroedBalanceGmd = wallet.balanceGmd;

    const [fundPoolId, incomeAccountId] = await Promise.all([
      resolveFundHoldingAccount(PRODUCT_CODES.ACCOUNT_TERMINATION),
      resolveFeeDestinationAccount(
        PRODUCT_CODES.ACCOUNT_TERMINATION,
        UCP_CODES.ACCOUNT_TERMINATION_FORFEITURE,
      ),
    ]);

    if (!fundPoolId || !incomeAccountId) {
      throw new AccountTerminateError(
        'Terminated balances ledger is not configured. Seed the system catalog (account-termination product, customer funds pool, and terminated-balances account) before zeroing wallets.',
        503,
        'JOURNAL_ACCOUNTS_NOT_CONFIGURED',
      );
    }

    const zeroReferenceId = randomUUID();
    const walletTx = await debitWallet({
      userId,
      amountGmd: zeroedBalanceGmd,
      type: WalletTransactionType.ADJUSTMENT,
      referenceType: 'admin_wallet_zero',
      referenceId: zeroReferenceId,
      description: 'Admin zeroed wallet balance before account termination',
      metadata: {
        adminUserId: opts.adminUserId ?? null,
        reason: opts.reason?.trim() || null,
        action: 'admin_terminate',
      },
    });

    const journal = await postAccountTerminationJournal({
      walletId: walletTx.walletId,
      walletTransactionId: walletTx.id,
      amountGmd: zeroedBalanceGmd,
      metadata: {
        adminUserId: opts.adminUserId ?? null,
        reason: opts.reason?.trim() || null,
        userId,
        zeroReferenceId,
        action: 'admin_terminate',
      },
    });

    if (!journal) {
      throw new AccountTerminateError(
        'Wallet was debited but the termination journal could not be posted. Contact engineering before retrying.',
        500,
        'JOURNAL_POST_FAILED',
        { walletTransactionId: walletTx.id, zeroedBalanceGmd },
      );
    }
  }

  await applyTermination(user, { requireStripeSuccess: false });

  log('Admin terminated customer account', {
    userId: user.id,
    adminUserId: opts.adminUserId ?? null,
    originalEmail: user.email,
    zeroedBalanceGmd,
    reason: opts.reason?.trim() || null,
  });

  return { zeroedBalanceGmd };
}
