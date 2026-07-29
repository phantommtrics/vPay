import type { Response } from 'express';
import { FundingOrderStatus, type FundingOrder, type Prisma } from '@prisma/client';
import { z } from 'zod';

import {
  authorizeDirectPayApsWallet,
  completeDirectPayApsWallet,
  createDirectPayOrder,
  getDirectPayPartnerConfig,
  listDirectPayWallets,
  startDirectPayWalletCheckout,
} from '../directpay/partner.js';
import { getPlatformDirectPayMerchant } from '../directpay/platform.js';
import { prisma } from '../db.js';
import { postWalletTopupJournal } from '../journal/service.js';
import {
  getFundingOrderMetadata,
  mergePaymentSourceMetadata,
  type FundingOrderMetadata,
} from '../fund-metadata.js';
import { getFundConfigAsync, isFundSimulationEnabled, toUserFacingFundError } from '../fund-config.js';
import { calculateWalletTopupFee } from '../settlement/platform-config.js';
import {
  creditWalletFromFundingOrder,
  ensureWalletForUser,
  getWalletBalance,
  requireWalletForUser,
  WalletNotFoundError,
  WalletPhoneConflictError,
} from '../wallet/service.js';
import { PhoneAlreadyInUseError } from '../phone.js';
import type { AuthedRequest } from './auth.js';
import type { DeviceAuthedRequest } from '../middleware/device.js';

const SIMULATED_WALLETS = [
  {
    gatewayId: 'sim-aps',
    code: 'aps-wallet',
    name: 'APS Wallet',
    checkoutAdapter: 'aps_wallet',
    hasStoredPayerPhone: false,
  },
  {
    gatewayId: 'sim-wave',
    code: 'wave',
    name: 'Wave',
    checkoutAdapter: 'wave',
    hasStoredPayerPhone: false,
  },
] as const;

export async function handleGetFundConfig(_req: AuthedRequest, res: Response): Promise<void> {
  res.json(await getFundConfigAsync());
}

const prepareSchema = z.object({
  amountGmd: z.number().positive(),
});

const walletSchema = z.object({
  gatewayCode: z.string().min(1),
  payerPhone: z.string().optional(),
  gatewayId: z.string().optional(),
});

const apsAuthorizeSchema = z.object({
  gatewayCode: z.string().min(1),
  payerMobile: z.string().min(1),
});

const apsCompleteSchema = z.object({
  gatewayCode: z.string().min(1),
  authState: z.string().min(1),
  otp: z.string().optional(),
});

const simulateSchema = z.object({
  gatewayCode: z.string().optional(),
});

function mergeFundingMetadata(
  order: { metadata: unknown },
  patch: NonNullable<FundingOrderMetadata['directPay']>,
): Prisma.InputJsonValue {
  const meta = getFundingOrderMetadata(order);
  return {
    ...meta,
    directPay: { ...(meta.directPay ?? {}), ...patch },
  } as Prisma.InputJsonValue;
}

function toPublicFundingOrder(order: FundingOrder) {
  return {
    id: order.id,
    amountGmd: order.amountGmd,
    feeGmd: order.feeGmd,
    totalGmd: order.totalGmd,
    usdEstimate: order.usdEstimate,
    status: order.status.toLowerCase(),
    directPayOrderId: order.directPayOrderId,
    directPayOrderPublicCode: order.directPayOrderPublicCode,
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

export async function handlePrepareFund(req: DeviceAuthedRequest, res: Response): Promise<void> {
  try {
    const simulation = isFundSimulationEnabled();
    if (!simulation && !getDirectPayPartnerConfig().configured) {
      res.status(503).json({ error: 'directPay payments are not configured on this server.' });
      return;
    }

    const parsed = prepareSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const userId = req.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user.kycComplete) {
      res.status(403).json({ error: 'KYC must be approved before funding.' });
      return;
    }

    const { exchangeRate } = await getFundConfigAsync();
    const amountGmd = parsed.data.amountGmd;
    const { feeGmd, totalGmd, feePercent } = await calculateWalletTopupFee(amountGmd);
    const usdEstimate = amountGmd / exchangeRate;

    if (simulation) {
      if (user.phone?.trim()) {
        try {
          await ensureWalletForUser(user);
        } catch (e) {
          if (e instanceof PhoneAlreadyInUseError || e instanceof WalletPhoneConflictError) {
            res.status(409).json({ error: e.message });
            return;
          }
          throw e;
        }
      }
      try {
        await requireWalletForUser(userId);
      } catch (e) {
        if (e instanceof WalletNotFoundError) {
          res.status(409).json({
            error: 'Add your phone number in profile to create your vPay wallet before topping up.',
          });
          return;
        }
        throw e;
      }

      const fundingOrder = await prisma.fundingOrder.create({
        data: {
          userId,
          deviceId: req.deviceId,
          amountGmd,
          feeGmd,
          totalGmd,
          usdEstimate,
          metadata: { simulated: true } as Prisma.InputJsonValue,
        },
      });

      res.status(201).json({
        ok: true,
        funding: toPublicFundingOrder(fundingOrder),
        exchangeRate,
        feePercent,
        simulationEnabled: true,
        businessId: null,
        order: null,
        wallets: [...SIMULATED_WALLETS],
      });
      return;
    }

    const platformMerchant = await getPlatformDirectPayMerchant();
    if (!platformMerchant) {
      res.status(503).json({
        error: 'Wallet top-ups are not available yet. Please try again later.',
      });
      return;
    }

    try {
      if (user.phone?.trim()) {
        try {
          await ensureWalletForUser(user);
        } catch (e) {
          if (e instanceof PhoneAlreadyInUseError || e instanceof WalletPhoneConflictError) {
            res.status(409).json({ error: e.message });
            return;
          }
          throw e;
        }
      }
      await requireWalletForUser(userId);
    } catch (e) {
      if (e instanceof WalletNotFoundError) {
        res.status(409).json({
          error: 'Add your phone number in profile to create your vPay wallet before topping up.',
        });
        return;
      }
      throw e;
    }

    const fundingOrder = await prisma.fundingOrder.create({
      data: {
        userId,
        deviceId: req.deviceId,
        amountGmd,
        feeGmd,
        totalGmd,
        usdEstimate,
      },
    });

    const order = await createDirectPayOrder(platformMerchant.businessId, {
      partnerExternalBookingId: fundingOrder.id,
      amountGmd: totalGmd,
      currency: 'GMD',
      category: 'vPay card funding',
    });

    const wallets = await listDirectPayWallets(platformMerchant.businessId, order.id);

    const updated = await prisma.fundingOrder.update({
      where: { id: fundingOrder.id },
      data: {
        directPayOrderId: order.id,
        directPayOrderPublicCode: order.publicCode,
        metadata: mergeFundingMetadata(fundingOrder, {
          businessId: platformMerchant.businessId,
          orderId: order.id,
          orderPublicCode: order.publicCode,
        }),
      },
    });

    res.status(201).json({
      ok: true,
      funding: toPublicFundingOrder(updated),
      exchangeRate,
      feePercent,
      simulationEnabled: false,
      businessId: platformMerchant.businessId,
      order: {
        id: order.id,
        publicCode: order.publicCode,
        status: order.status,
        total: order.total,
        currency: order.currency,
      },
      wallets,
      ...(wallets.length === 0
        ? {
            prepareHint:
              'No payment wallets are available yet. Ask the platform operator to configure Wave or APS.',
          }
        : {}),
    });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : 'directPay prepare failed';
    console.error('[POST /api/fund/prepare]', raw);
    res.status(502).json({ error: toUserFacingFundError(raw) });
  }
}

async function loadFundingOrder(
  req: AuthedRequest,
  res: Response,
): Promise<{ order: FundingOrder; businessId: string } | null> {
  if (!getDirectPayPartnerConfig().configured) {
    res.status(503).json({ error: 'directPay payments are not configured on this server.' });
    return null;
  }

  const userId = req.userId!;
  const order = await prisma.fundingOrder.findFirst({
    where: { id: String(req.params.id), userId },
  });
  if (!order) {
    res.status(404).json({ error: 'Funding order not found' });
    return null;
  }
  if (order.status === FundingOrderStatus.PAID) {
    res.status(400).json({ error: 'This funding order is already paid.' });
    return null;
  }

  const meta = getFundingOrderMetadata(order);
  const businessId =
    meta.directPay?.businessId ?? (await getPlatformDirectPayMerchant())?.businessId;
  if (!businessId) {
    res.status(503).json({ error: 'Wallet top-ups are not available yet. Please try again later.' });
    return null;
  }

  return { order, businessId };
}

export async function handleFundWallet(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const loaded = await loadFundingOrder(req, res);
    if (!loaded) return;

    const parsed = walletSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const { order, businessId } = loaded;
    const meta = getFundingOrderMetadata(order);
    let orderId = order.directPayOrderId ?? meta.directPay?.orderId;
    if (!orderId) {
      res.status(409).json({ error: 'No directPay order for this funding request. Create a new one.' });
      return;
    }

    const checkout = await startDirectPayWalletCheckout(businessId, orderId, parsed.data);

    await prisma.fundingOrder.update({
      where: { id: order.id },
      data: {
        metadata: mergePaymentSourceMetadata(order, {
          gatewayCode: parsed.data.gatewayCode,
        }),
      },
    });

    res.json({
      ok: true,
      fundingId: order.id,
      businessId,
      orderId,
      ...checkout,
    });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : 'directPay wallet checkout failed';
    console.error('[POST /api/fund/:id/wallet]', raw);
    res.status(502).json({ error: toUserFacingFundError(raw) });
  }
}

export async function handleFundApsAuthorize(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const loaded = await loadFundingOrder(req, res);
    if (!loaded) return;

    const parsed = apsAuthorizeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const { order, businessId } = loaded;
    const meta = getFundingOrderMetadata(order);
    const orderId = order.directPayOrderId ?? meta.directPay?.orderId;
    if (!orderId) {
      res.status(409).json({ error: 'No directPay order for this funding request.' });
      return;
    }

    const out = await authorizeDirectPayApsWallet(businessId, orderId, parsed.data);
    if (!out.authState) {
      res.status(502).json({ error: 'directPay APS authorize did not return authState.' });
      return;
    }

    const withSource = mergePaymentSourceMetadata(order, {
      gatewayCode: parsed.data.gatewayCode,
    });
    await prisma.fundingOrder.update({
      where: { id: order.id },
      data: {
        metadata: mergeFundingMetadata(
          { ...order, metadata: withSource as FundingOrder['metadata'] },
          { authState: out.authState },
        ),
      },
    });

    res.json({ ok: true, authState: out.authState, requiresOtp: out.requiresOtp });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : 'directPay APS authorize failed';
    console.error('[POST /api/fund/:id/aps/authorize]', raw);
    res.status(502).json({ error: toUserFacingFundError(raw) });
  }
}

export async function handleFundApsComplete(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const loaded = await loadFundingOrder(req, res);
    if (!loaded) return;

    const parsed = apsCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const { order, businessId } = loaded;
    const meta = getFundingOrderMetadata(order);
    const orderId = order.directPayOrderId ?? meta.directPay?.orderId;
    if (!orderId) {
      res.status(409).json({ error: 'No directPay order for this funding request.' });
      return;
    }

    const authState = meta.directPay?.authState?.trim() || parsed.data.authState.trim();
    if (!authState) {
      res.status(400).json({ error: 'APS authorization required. Tap Fund card to receive a new code.' });
      return;
    }

    const data = await completeDirectPayApsWallet(businessId, orderId, {
      gatewayCode: parsed.data.gatewayCode,
      authState,
      otp: parsed.data.otp,
    });

    await prisma.fundingOrder.update({
      where: { id: order.id },
      data: {
        metadata: mergePaymentSourceMetadata(order, {
          gatewayCode: parsed.data.gatewayCode,
        }),
      },
    });

    res.json({ ok: true, data });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : 'directPay APS complete failed';
    console.error('[POST /api/fund/:id/aps/complete]', raw);
    res.status(502).json({ error: toUserFacingFundError(raw) });
  }
}

export async function handleSimulateFund(req: AuthedRequest, res: Response): Promise<void> {
  if (!isFundSimulationEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const userId = req.userId!;
    const parsed = simulateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
      return;
    }

    const order = await prisma.fundingOrder.findFirst({
      where: { id: String(req.params.id), userId },
    });
    if (!order) {
      res.status(404).json({ error: 'Funding order not found' });
      return;
    }
    if (order.status === FundingOrderStatus.PAID) {
      res.status(400).json({ error: 'This funding order is already paid.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const prepared = await prisma.fundingOrder.update({
      where: { id: order.id },
      data: {
        metadata: mergePaymentSourceMetadata(order, {
          ...(parsed.data.gatewayCode ? { gatewayCode: parsed.data.gatewayCode } : {}),
          simulated: true,
        }),
      },
    });

    const walletTx = await creditWalletFromFundingOrder(userId, prepared.id, prepared.amountGmd);
    const meta = getFundingOrderMetadata(prepared);

    const updated = await prisma.fundingOrder.update({
      where: { id: order.id },
      data: {
        status: FundingOrderStatus.PAID,
        paidAt: new Date(),
        directPayPaymentId: `sim_${order.id}`,
        metadata: {
          ...meta,
          simulated: true,
          walletCredited: true,
          walletTransactionId: walletTx.id,
        } as Prisma.InputJsonValue,
      },
    });

    await postWalletTopupJournal({
      fundingOrderId: prepared.id,
      walletId: walletTx.walletId,
      walletTransactionId: walletTx.id,
      amountGmd: prepared.amountGmd,
      feeGmd: prepared.feeGmd,
      totalGmd: prepared.totalGmd,
      metadata: { walletTransactionId: walletTx.id, simulated: true },
    });

    const wallet = await getWalletBalance(userId);

    res.json({
      ok: true,
      funding: toPublicFundingOrder(updated),
      wallet,
      walletTransactionId: walletTx.id,
    });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : 'Simulated funding failed';
    console.error('[POST /api/fund/:id/simulate]', raw);
    res.status(502).json({ error: toUserFacingFundError(raw) });
  }
}

export async function handleGetFundingOrder(req: AuthedRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const order = await prisma.fundingOrder.findFirst({
    where: { id: String(req.params.id), userId },
  });
  if (!order) {
    res.status(404).json({ error: 'Funding order not found' });
    return;
  }
  res.json({ funding: toPublicFundingOrder(order) });
}
