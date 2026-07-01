import type { UcpCalculationType, Ucp, UcpSlab } from '@prisma/client';

import type { ProductCode } from './catalog-codes.js';
import { PRODUCT_CODES } from './catalog-codes.js';

export type UcpWithSlabs = Ucp & { slabs: UcpSlab[] };

export function isCatalogEntryActive(
  status: string,
  startDate: Date | null,
  expiryDate: Date | null,
  at: Date = new Date(),
): boolean {
  if (status !== 'ACTIVE') return false;
  if (startDate && at < startDate) return false;
  if (expiryDate && at > expiryDate) return false;
  return true;
}

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

export function calculateSlabChargeFromTiers(tiers: WalletTopupSlabTier[], baseAmount: number): number {
  const sorted = [...tiers].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.minAmount - b.minAmount,
  );
  for (const slab of sorted) {
    const inMin = baseAmount >= slab.minAmount;
    const inMax = slab.maxAmount == null || baseAmount <= slab.maxAmount;
    if (!inMin || !inMax) continue;

    if (slab.valueType === 'PERCENT') {
      return baseAmount * (slab.value / 100);
    }
    return slab.value;
  }
  return 0;
}

function calculateSlabCharge(ucp: UcpWithSlabs, baseAmount: number): number {
  return calculateSlabChargeFromTiers(ucp.slabs, baseAmount);
}

export function calculateWalletTopupFeeFromPricing(
  pricing: WalletTopupFeePricing,
  amountGmd: number,
): number {
  if (pricing.type === 'fixed') {
    return amountGmd * pricing.feePercent;
  }
  return calculateSlabChargeFromTiers(pricing.slabs, amountGmd);
}

/**
 * Read the raw scalar stored on a FIXED UCP (fee rate, exchange rate, flat fee, etc.).
 * Use this when loading platform config — not when computing a charge on an amount.
 */
export function readUcpScalarValue(ucp: UcpWithSlabs): number | null {
  if (ucp.ucpType === 'SLAB') return null;
  if (ucp.fixedValue == null) return null;
  return ucp.fixedValue;
}

/**
 * Compute a transaction charge from a UCP for a given product and base amount.
 */
export function calculateUcpCharge(
  ucp: UcpWithSlabs,
  productCode: ProductCode,
  baseAmount: number,
): number {
  if (ucp.ucpType === 'SLAB') {
    return calculateSlabCharge(ucp, baseAmount);
  }

  const value = ucp.fixedValue ?? 0;

  switch (productCode) {
    case PRODUCT_CODES.WALLET_TOPUP:
      return baseAmount * value;
    case PRODUCT_CODES.CARD_ISSUANCE:
      return value;
    case PRODUCT_CODES.CARD_FUND:
      return baseAmount * value;
    default:
      return value;
  }
}

/** @deprecated Use readUcpScalarValue or calculateUcpCharge */
export function calculateUcpValue(
  ucp: UcpWithSlabs,
  productCode: ProductCode,
  baseAmount = 0,
): number {
  if (baseAmount === 0 && ucp.ucpType === 'FIXED') {
    return readUcpScalarValue(ucp) ?? 0;
  }
  return calculateUcpCharge(ucp, productCode, baseAmount);
}

export function applyCalculationType(
  baseAmount: number,
  charge: number,
  calculationType: UcpCalculationType,
): { netAmount: number; charge: number; totalAmount: number } {
  if (calculationType === 'INCLUSIVE') {
    return {
      charge,
      netAmount: baseAmount - charge,
      totalAmount: baseAmount,
    };
  }
  return {
    charge,
    netAmount: baseAmount,
    totalAmount: baseAmount + charge,
  };
}
