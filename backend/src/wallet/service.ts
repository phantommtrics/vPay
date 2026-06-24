import {
  WalletTransactionType,
  type User,
  type VPayWallet,
  type WalletTransaction,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { prisma } from '../db.js';
import { getFundConfig } from '../fund-config.js';
import {
  getFundingOrderMetadata,
  getWalletTxFundingSource,
  paymentSourceLabel,
  resolvePaymentSourceFromFundingMetadata,
  walletDepositMetadataFromFundingOrder,
  type WalletFundingSource,
} from '../fund-metadata.js';
import { log } from '../logger.js';
import {
  assertPhoneAvailable,
  PhoneAlreadyInUseError,
  resolveUserPhoneE164,
  WalletPhoneConflictError,
} from '../phone.js';
import { sanitizeUserFacingText } from '../user-facing-text.js';

export class InsufficientWalletBalanceError extends Error {
  constructor() {
    super('Insufficient wallet balance');
    this.name = 'InsufficientWalletBalanceError';
  }
}

export { PhoneAlreadyInUseError, WalletPhoneConflictError } from '../phone.js';

export class WalletNotFoundError extends Error {
  constructor() {
    super('VPay wallet not found. Add your phone number in profile first.');
    this.name = 'WalletNotFoundError';
  }
}

function normalizeUserPhone(user: User): string {
  return resolveUserPhoneE164(user);
}

export async function ensureWalletForUser(user: User): Promise<VPayWallet> {
  const phoneNumber = normalizeUserPhone(user);
  await assertPhoneAvailable(user.id, phoneNumber);

  const existing = await prisma.vPayWallet.findUnique({ where: { userId: user.id } });
  if (existing) {
    if (existing.phoneNumber !== phoneNumber) {
      const phoneTaken = await prisma.vPayWallet.findUnique({ where: { phoneNumber } });
      if (phoneTaken && phoneTaken.userId !== user.id) {
        throw new PhoneAlreadyInUseError();
      }
      return prisma.vPayWallet.update({
        where: { id: existing.id },
        data: { phoneNumber },
      });
    }
    return existing;
  }

  const phoneTaken = await prisma.vPayWallet.findUnique({ where: { phoneNumber } });
  if (phoneTaken) {
    throw new PhoneAlreadyInUseError();
  }

  const wallet = await prisma.vPayWallet.create({
    data: {
      userId: user.id,
      phoneNumber,
    },
  });

  log('VPay wallet created', { userId: user.id, phoneNumber });
  return wallet;
}

export async function getWalletForUser(userId: string): Promise<VPayWallet | null> {
  return prisma.vPayWallet.findUnique({ where: { userId } });
}

export async function requireWalletForUser(userId: string): Promise<VPayWallet> {
  const wallet = await getWalletForUser(userId);
  if (!wallet) {
    throw new WalletNotFoundError();
  }
  return wallet;
}

export async function getWalletBalance(userId: string): Promise<{
  phoneNumber: string;
  balanceGmd: number;
  usdEstimate: number;
  exchangeRate: number;
}> {
  const wallet = await requireWalletForUser(userId);
  const { exchangeRate } = getFundConfig();
  return {
    phoneNumber: wallet.phoneNumber,
    balanceGmd: wallet.balanceGmd,
    usdEstimate: wallet.balanceGmd / exchangeRate,
    exchangeRate,
  };
}

type WalletMutationInput = {
  userId: string;
  amountGmd: number;
  type: WalletTransactionType;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  usdEstimate?: number;
  exchangeRate?: number;
  metadata?: Prisma.InputJsonValue;
};

async function findExistingWalletTx(
  referenceType: string,
  referenceId: string,
): Promise<WalletTransaction | null> {
  return prisma.walletTransaction.findFirst({
    where: { referenceType, referenceId },
  });
}

export async function creditWallet(input: WalletMutationInput): Promise<WalletTransaction> {
  const { userId, amountGmd, type, referenceType, referenceId } = input;

  if (amountGmd <= 0) {
    throw new Error('Credit amount must be positive');
  }

  if (referenceType && referenceId) {
    const existing = await findExistingWalletTx(referenceType, referenceId);
    if (existing) {
      return existing;
    }
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.vPayWallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const balanceBeforeGmd = wallet.balanceGmd;
    const balanceAfterGmd = balanceBeforeGmd + amountGmd;

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amountGmd,
        balanceBeforeGmd,
        balanceAfterGmd,
        usdEstimate: input.usdEstimate ?? null,
        exchangeRate: input.exchangeRate ?? null,
        referenceType: referenceType ?? null,
        referenceId: referenceId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? undefined,
      },
    });

    await tx.vPayWallet.update({
      where: { id: wallet.id },
      data: { balanceGmd: balanceAfterGmd },
    });

    return walletTx;
  });
}

export async function debitWallet(input: WalletMutationInput): Promise<WalletTransaction> {
  const { userId, amountGmd } = input;

  if (amountGmd <= 0) {
    throw new Error('Debit amount must be positive');
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.vPayWallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new WalletNotFoundError();
    }

    if (wallet.balanceGmd < amountGmd) {
      throw new InsufficientWalletBalanceError();
    }

    const balanceBeforeGmd = wallet.balanceGmd;
    const balanceAfterGmd = balanceBeforeGmd - amountGmd;

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: input.type,
        amountGmd,
        balanceBeforeGmd,
        balanceAfterGmd,
        usdEstimate: input.usdEstimate ?? null,
        exchangeRate: input.exchangeRate ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? undefined,
      },
    });

    await tx.vPayWallet.update({
      where: { id: wallet.id },
      data: { balanceGmd: balanceAfterGmd },
    });

    return walletTx;
  });
}

export async function creditWalletFromFundingOrder(
  userId: string,
  fundingOrderId: string,
  amountGmd: number,
): Promise<WalletTransaction> {
  const order = await prisma.fundingOrder.findUnique({ where: { id: fundingOrderId } });
  if (!order) {
    throw new Error('Funding order not found');
  }

  const orderMeta = getFundingOrderMetadata(order);
  const fundingSource = resolvePaymentSourceFromFundingMetadata(orderMeta);
  const { exchangeRate } = getFundConfig();

  return creditWallet({
    userId,
    amountGmd,
    type: WalletTransactionType.DEPOSIT,
    referenceType: 'funding_order',
    referenceId: fundingOrderId,
    description: fundingSource
      ? `Wallet top-up via ${paymentSourceLabel(fundingSource)}`
      : 'Wallet top-up',
    usdEstimate: amountGmd / exchangeRate,
    exchangeRate,
    metadata: walletDepositMetadataFromFundingOrder(orderMeta),
  });
}

export type PublicWalletTransaction = {
  id: string;
  type: string;
  amountGmd: number;
  balanceBeforeGmd: number;
  balanceAfterGmd: number;
  usdEstimate: number | null;
  exchangeRate: number | null;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  fundingSource: WalletFundingSource | null;
  fundingSourceLabel: string | null;
  createdAt: string;
};

function toPublicWalletTransaction(
  tx: WalletTransaction,
  fundingOrderMeta?: ReturnType<typeof getFundingOrderMetadata>,
): PublicWalletTransaction {
  let { fundingSource, fundingSourceLabel } = getWalletTxFundingSource(tx);
  if (!fundingSource && fundingOrderMeta) {
    fundingSource = resolvePaymentSourceFromFundingMetadata(fundingOrderMeta);
    fundingSourceLabel = fundingSource ? paymentSourceLabel(fundingSource) : null;
  }

  return {
    id: tx.id,
    type: tx.type.toLowerCase(),
    amountGmd: tx.amountGmd,
    balanceBeforeGmd: tx.balanceBeforeGmd,
    balanceAfterGmd: tx.balanceAfterGmd,
    usdEstimate: tx.usdEstimate,
    exchangeRate: tx.exchangeRate,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    description: sanitizeUserFacingText(tx.description),
    fundingSource,
    fundingSourceLabel,
    createdAt: tx.createdAt.toISOString(),
  };
}

export async function listWalletTransactions(
  userId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<{ transactions: PublicWalletTransaction[]; nextCursor: string | null }> {
  const wallet = await requireWalletForUser(userId);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

  const rows = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(options.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const fundingOrderIds = [
    ...new Set(
      page
        .filter((tx) => tx.referenceType === 'funding_order' && tx.referenceId)
        .map((tx) => tx.referenceId as string),
    ),
  ];
  const fundingOrders =
    fundingOrderIds.length > 0
      ? await prisma.fundingOrder.findMany({
          where: { id: { in: fundingOrderIds } },
          select: { id: true, metadata: true },
        })
      : [];
  const fundingOrderMetaById = new Map(
    fundingOrders.map((order) => [order.id, getFundingOrderMetadata(order)]),
  );

  const transactions = page.map((tx) =>
    toPublicWalletTransaction(
      tx,
      tx.referenceId ? fundingOrderMetaById.get(tx.referenceId) : undefined,
    ),
  );

  return {
    transactions,
    nextCursor: hasMore ? transactions[transactions.length - 1]?.id ?? null : null,
  };
}
