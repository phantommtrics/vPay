import type { FundingOrder, Prisma } from '@prisma/client';

export type WalletFundingSource = 'aps' | 'wave' | 'simulation';

export type FundingOrderMetadata = {
  simulated?: boolean;
  gatewayCode?: string;
  gatewayName?: string;
  paymentSource?: WalletFundingSource;
  directPay?: {
    businessId?: string;
    orderId?: string;
    orderPublicCode?: string;
    authState?: string;
    webhookDedupe?: string[];
    lastWebhookEvent?: string;
    lastPaymentId?: string;
  };
};

export function getFundingOrderMetadata(order: { metadata: unknown }): FundingOrderMetadata {
  if (!order.metadata || typeof order.metadata !== 'object') return {};
  return order.metadata as FundingOrderMetadata;
}

export function gatewayCodeToPaymentSource(gatewayCode: string | undefined): WalletFundingSource | null {
  if (!gatewayCode) return null;
  const code = gatewayCode.toLowerCase();
  if (code.includes('aps')) return 'aps';
  if (code.includes('wave')) return 'wave';
  return null;
}

export function paymentSourceLabel(source: WalletFundingSource): string {
  switch (source) {
    case 'aps':
      return 'APS Wallet';
    case 'wave':
      return 'Wave';
    case 'simulation':
      return 'Test payment';
  }
}

export function resolvePaymentSourceFromFundingMetadata(
  meta: FundingOrderMetadata,
): WalletFundingSource | null {
  if (meta.paymentSource) return meta.paymentSource;
  const fromGateway = gatewayCodeToPaymentSource(meta.gatewayCode);
  if (fromGateway) return fromGateway;
  if (meta.simulated) return 'simulation';
  return null;
}

export function mergePaymentSourceMetadata(
  order: { metadata: unknown },
  patch: { gatewayCode?: string; gatewayName?: string; simulated?: boolean },
): Prisma.InputJsonValue {
  const meta = getFundingOrderMetadata(order);
  const gatewayCode = patch.gatewayCode ?? meta.gatewayCode;
  const fromGateway = gatewayCodeToPaymentSource(gatewayCode);
  const paymentSource: WalletFundingSource | undefined = patch.simulated
    ? (fromGateway ?? 'simulation')
    : (fromGateway ?? meta.paymentSource);

  return {
    ...meta,
    ...(patch.gatewayName ? { gatewayName: patch.gatewayName } : {}),
    ...(patch.simulated ? { simulated: true } : {}),
    ...(gatewayCode ? { gatewayCode } : {}),
    ...(paymentSource ? { paymentSource } : {}),
  } as Prisma.InputJsonValue;
}

type WalletTxMetadata = {
  fundingSource?: WalletFundingSource;
  fundingSourceLabel?: string;
  gatewayCode?: string;
};

export function getWalletTxFundingSource(tx: {
  metadata: unknown;
}): { fundingSource: WalletFundingSource | null; fundingSourceLabel: string | null } {
  if (!tx.metadata || typeof tx.metadata !== 'object') {
    return { fundingSource: null, fundingSourceLabel: null };
  }
  const meta = tx.metadata as WalletTxMetadata;
  const fundingSource = meta.fundingSource ?? null;
  const fundingSourceLabel =
    meta.fundingSourceLabel ??
    (fundingSource ? paymentSourceLabel(fundingSource) : null);
  return { fundingSource, fundingSourceLabel };
}

export function walletDepositMetadataFromFundingOrder(
  meta: FundingOrderMetadata,
): Prisma.InputJsonValue | undefined {
  const fundingSource = resolvePaymentSourceFromFundingMetadata(meta);
  if (!fundingSource) return undefined;
  return {
    fundingSource,
    fundingSourceLabel: paymentSourceLabel(fundingSource),
    ...(meta.gatewayCode ? { gatewayCode: meta.gatewayCode } : {}),
  };
}
