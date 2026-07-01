export type WalletTopupSlabTier = {
  minAmount: number;
  maxAmount: number | null;
  value: number;
  valueType: 'PERCENT' | 'FIXED_AMOUNT';
  sortOrder?: number;
};

export type WalletTopupFeePricing =
  | { type: 'fixed'; feePercent: number }
  | { type: 'slab'; slabs: WalletTopupSlabTier[] };

export type FundConfig = {
  exchangeRate: number;
  feePercent?: number;
  walletTopupFee: WalletTopupFeePricing;
  simulationEnabled: boolean;
};

export function formatFundFeeLabel(percent: number): string {
  const value = percent * 100;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function calculateSlabFee(slabs: WalletTopupSlabTier[], amountGmd: number): number {
  const sorted = [...slabs].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.minAmount - b.minAmount,
  );
  for (const slab of sorted) {
    const inMin = amountGmd >= slab.minAmount;
    const inMax = slab.maxAmount == null || amountGmd <= slab.maxAmount;
    if (!inMin || !inMax) continue;

    if (slab.valueType === 'PERCENT') {
      return amountGmd * (slab.value / 100);
    }
    return slab.value;
  }
  return 0;
}

export function estimateWalletTopupFee(pricing: WalletTopupFeePricing, amountGmd: number): number {
  if (amountGmd <= 0) return 0;
  if (pricing.type === 'fixed') {
    return amountGmd * pricing.feePercent;
  }
  return calculateSlabFee(pricing.slabs, amountGmd);
}

export function formatWalletTopupFeeLabel(pricing: WalletTopupFeePricing, amountGmd: number): string {
  if (pricing.type === 'fixed') {
    return formatFundFeeLabel(pricing.feePercent);
  }
  if (amountGmd > 0) {
    const fee = estimateWalletTopupFee(pricing, amountGmd);
    if (fee > 0) {
      return formatFundFeeLabel(fee / amountGmd);
    }
  }
  return 'Varies by amount';
}
