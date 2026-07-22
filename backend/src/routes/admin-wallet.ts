import type { Response } from 'express';
import { z } from 'zod';

import { findUserById } from '../db.js';
import { getFundConfigAsync } from '../fund-config.js';
import { getCardBalanceUsdForUser } from '../stripe/card-balance.js';
import type { AdminAuthedRequest } from '../middleware/admin-auth.js';
import { prisma } from '../db.js';
import {
  getWalletForUser,
  listWalletTransactions,
  WalletNotFoundError,
} from '../wallet/service.js';
const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function toAdminFundingOrder(order: {
  id: string;
  userId: string;
  amountGmd: number;
  feeGmd: number;
  totalGmd: number;
  usdEstimate: number;
  status: string;
  directPayOrderId: string | null;
  directPayOrderPublicCode: string | null;
  directPayPaymentId: string | null;
  metadata: unknown;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: order.id,
    userId: order.userId,
    amountGmd: order.amountGmd,
    feeGmd: order.feeGmd,
    totalGmd: order.totalGmd,
    usdEstimate: order.usdEstimate,
    status: String(order.status).toLowerCase(),
    directPayOrderId: order.directPayOrderId,
    directPayOrderPublicCode: order.directPayOrderPublicCode,
    directPayPaymentId: order.directPayPaymentId,
    metadata: order.metadata,
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function toAdminCardFundTx(tx: {
  id: string;
  userId: string;
  walletTransactionId: string;
  amountGmd: number;
  feeGmd: number;
  amountUsd: number;
  exchangeRate: number;
  stripeBalanceBeforeUsd: number;
  stripeBalanceAfterUsd: number;
  gmdEstimateBefore: number;
  gmdEstimateAfter: number;
  stripeCredited: boolean;
  stripeTransferId: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: tx.id,
    userId: tx.userId,
    walletTransactionId: tx.walletTransactionId,
    amountGmd: tx.amountGmd,
    feeGmd: tx.feeGmd,
    totalGmd: tx.amountGmd + tx.feeGmd,
    amountUsd: tx.amountUsd,
    exchangeRate: tx.exchangeRate,
    stripeBalanceBeforeUsd: tx.stripeBalanceBeforeUsd,
    stripeBalanceAfterUsd: tx.stripeBalanceAfterUsd,
    gmdEstimateBefore: tx.gmdEstimateBefore,
    gmdEstimateAfter: tx.gmdEstimateAfter,
    stripeCredited: tx.stripeCredited,
    stripeTransferId: tx.stripeTransferId,
    status: tx.status.toLowerCase(),
    createdAt: tx.createdAt.toISOString(),
  };
}

export async function handleAdminUserWallet(req: AdminAuthedRequest, res: Response): Promise<void> {
  const userId = String(req.params.userId);
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const wallet = await getWalletForUser(userId);
  if (!wallet) {
    res.json({ wallet: null, card: null });
    return;
  }

  const { exchangeRate } = await getFundConfigAsync();
  const stripeResult = await getCardBalanceUsdForUser(user);

  res.json({
    wallet: {
      id: wallet.id,
      phoneNumber: wallet.phoneNumber,
      balanceGmd: wallet.balanceGmd,
      usdEstimate: wallet.balanceGmd / exchangeRate,
      exchangeRate,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
    },
    card: {
      balanceUsd: stripeResult.balanceUsd,
      balanceGmdEstimate: stripeResult.balanceUsd * exchangeRate,
      balanceSource: stripeResult.balanceSource,
      exchangeRate,
    },
  });
}

export async function handleAdminUserWalletTransactions(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const userId = String(req.params.userId);
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  try {
    const result = await listWalletTransactions(userId, {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof WalletNotFoundError) {
      res.json({ transactions: [], nextCursor: null });
      return;
    }
    const msg = e instanceof Error ? e.message : 'Failed to load transactions';
    res.status(500).json({ error: msg });
  }
}

export async function handleAdminUserFundingOrders(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const userId = String(req.params.userId);
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  const limit = parsed.data.limit ?? 25;
  const rows = await prisma.fundingOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const orders = slice.map(toAdminFundingOrder);

  res.json({
    orders,
    nextCursor: hasMore ? orders[orders.length - 1]?.id ?? null : null,
  });
}

export async function handleAdminUserCardFundTransactions(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const userId = String(req.params.userId);
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid query' });
    return;
  }

  const limit = parsed.data.limit ?? 25;
  const rows = await prisma.cardFundTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const transactions = slice.map(toAdminCardFundTx);

  res.json({
    transactions,
    nextCursor: hasMore ? transactions[transactions.length - 1]?.id ?? null : null,
  });
}

export async function handleAdminPlatformActivity(
  req: AdminAuthedRequest,
  res: Response,
): Promise<void> {
  const limit = Math.min(
    Math.max(typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 30, 1),
    100,
  );

  const [walletTxs, fundingOrders] = await Promise.all([
    prisma.walletTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        wallet: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.fundingOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  res.json({
    walletTransactions: walletTxs.map((tx) => ({
      id: tx.id,
      type: tx.type.toLowerCase(),
      amountGmd: tx.amountGmd,
      balanceAfterGmd: tx.balanceAfterGmd,
      description: tx.description,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt.toISOString(),
      user: tx.wallet.user,
    })),
    fundingOrders: fundingOrders.map((order) => ({
      ...toAdminFundingOrder(order),
      user: order.user,
    })),
  });
}
