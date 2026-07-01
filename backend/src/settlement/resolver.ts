import { prisma } from '../db.js';
import type { ProductCode, UcpCode } from './catalog-codes.js';
import { readUcpScalarValue, calculateUcpCharge, isCatalogEntryActive, type UcpWithSlabs } from './calculator.js';
import { invalidatePlatformConfigCache } from './config-cache.js';

const ucpInclude = { slabs: { orderBy: { sortOrder: 'asc' as const } } } as const;

export function invalidateSettlementCache(): void {
  invalidatePlatformConfigCache();
}

async function findActiveProductByCode(code: ProductCode) {
  const product = await prisma.product.findUnique({
    where: { code },
    include: {
      settlementRequests: {
        include: { ucp: { include: ucpInclude } },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!product || !isCatalogEntryActive(product.status, product.startDate, product.expiryDate)) {
    return null;
  }

  return product;
}

async function findActiveUcpByCode(code: UcpCode): Promise<UcpWithSlabs | null> {
  const ucp = await prisma.ucp.findUnique({
    where: { code },
    include: ucpInclude,
  });

  if (!ucp || !isCatalogEntryActive(ucp.status, ucp.startDate, ucp.expiryDate)) {
    return null;
  }

  return ucp;
}

export async function resolveUcpForProduct(
  productCode: ProductCode,
  ucpCode: UcpCode,
): Promise<UcpWithSlabs | null> {
  const product = await findActiveProductByCode(productCode);
  if (!product) return findActiveUcpByCode(ucpCode);

  const match = product.settlementRequests.find((sr) => {
    if (!isCatalogEntryActive(sr.status, sr.startDate, sr.expiryDate)) return false;
    return sr.ucp.code === ucpCode && isCatalogEntryActive(sr.ucp.status, sr.ucp.startDate, sr.ucp.expiryDate);
  });

  if (match) return match.ucp;
  return findActiveUcpByCode(ucpCode);
}

export async function resolveScalarFromSettlement(
  productCode: ProductCode,
  ucpCode: UcpCode,
): Promise<number | null> {
  const ucp = await resolveUcpForProduct(productCode, ucpCode);
  if (!ucp) return null;
  return readUcpScalarValue(ucp);
}

export async function resolveChargeFromSettlement(
  productCode: ProductCode,
  ucpCode: UcpCode,
  baseAmount: number,
): Promise<number | null> {
  const ucp = await resolveUcpForProduct(productCode, ucpCode);
  if (!ucp) return null;
  return calculateUcpCharge(ucp, productCode, baseAmount);
}

export async function listActiveSettlementRequests(productCode?: ProductCode) {
  const now = new Date();
  const requests = await prisma.settlementRequest.findMany({
    where: productCode
      ? { product: { code: productCode }, status: 'ACTIVE' }
      : { status: 'ACTIVE' },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          displayName: true,
          currency: true,
          status: true,
          startDate: true,
          expiryDate: true,
        },
      },
      ucp: { include: ucpInclude },
    },
    orderBy: [{ product: { name: 'asc' } }, { priority: 'asc' }, { name: 'asc' }],
  });

  return requests.filter(
    (sr) =>
      isCatalogEntryActive(sr.status, sr.startDate, sr.expiryDate, now) &&
      isCatalogEntryActive(sr.product.status, sr.product.startDate, sr.product.expiryDate, now) &&
      isCatalogEntryActive(sr.ucp.status, sr.ucp.startDate, sr.ucp.expiryDate, now),
  );
}
