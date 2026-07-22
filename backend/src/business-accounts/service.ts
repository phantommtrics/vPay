import {
  BusinessAccountTxnType,
  CatalogStatus,
  type BusinessAccountTransaction,
  type Prisma,
} from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import type { ProductCode, UcpCode } from '../settlement/catalog-codes.js';
import { isCatalogEntryActive } from '../settlement/calculator.js';

type BusinessAccountMutationInput = {
  accountId: string;
  amount: number;
  referenceType: string;
  referenceId: string;
  productCode?: ProductCode | string;
  ucpCode?: UcpCode | string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
};

async function findExistingBusinessAccountTx(
  referenceType: string,
  referenceId: string,
  accountId: string,
): Promise<BusinessAccountTransaction | null> {
  return prisma.businessAccountTransaction.findFirst({
    where: { referenceType, referenceId, accountId },
  });
}

async function mutateBusinessAccount(
  type: BusinessAccountTxnType,
  input: BusinessAccountMutationInput,
): Promise<BusinessAccountTransaction | null> {
  const { accountId, amount, referenceType, referenceId } = input;

  if (amount <= 0) {
    throw new Error('Business account amount must be positive');
  }

  const existing = await findExistingBusinessAccountTx(referenceType, referenceId, accountId);
  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.businessAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      log('Business account not found for posting', { accountId, referenceType, referenceId });
      return null;
    }
    if (account.status !== CatalogStatus.ACTIVE) {
      log('Business account inactive; skipping posting', { accountId, referenceType, referenceId });
      return null;
    }

    const balanceBefore = account.balance;
    const balanceAfter =
      type === BusinessAccountTxnType.CREDIT ? balanceBefore + amount : balanceBefore - amount;

    if (type === BusinessAccountTxnType.DEBIT && balanceAfter < 0) {
      log('Business account insufficient balance; skipping posting', {
        accountId,
        balanceBefore,
        amount,
        referenceType,
        referenceId,
      });
      return null;
    }

    const row = await tx.businessAccountTransaction.create({
      data: {
        accountId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        productCode: input.productCode ?? null,
        ucpCode: input.ucpCode ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? undefined,
      },
    });

    await tx.businessAccount.update({
      where: { id: accountId },
      data: { balance: balanceAfter },
    });

    return row;
  });
}

export async function creditBusinessAccount(
  input: BusinessAccountMutationInput,
): Promise<BusinessAccountTransaction | null> {
  return mutateBusinessAccount(BusinessAccountTxnType.CREDIT, input);
}

export async function debitBusinessAccount(
  input: BusinessAccountMutationInput,
): Promise<BusinessAccountTransaction | null> {
  return mutateBusinessAccount(BusinessAccountTxnType.DEBIT, input);
}

export async function resolveFeeDestinationAccount(
  productCode: ProductCode | string,
  ucpCode: UcpCode | string,
): Promise<string | null> {
  const now = new Date();
  const settlement = await prisma.settlementRequest.findFirst({
    where: {
      status: CatalogStatus.ACTIVE,
      feeDestinationAccountId: { not: null },
      product: { code: productCode },
      ucp: { code: ucpCode },
    },
    include: {
      product: true,
      ucp: true,
      feeDestinationAccount: true,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  if (!settlement?.feeDestinationAccountId || !settlement.feeDestinationAccount) {
    return null;
  }

  if (
    !isCatalogEntryActive(settlement.status, settlement.startDate, settlement.expiryDate, now) ||
    !isCatalogEntryActive(
      settlement.product.status,
      settlement.product.startDate,
      settlement.product.expiryDate,
      now,
    ) ||
    !isCatalogEntryActive(settlement.ucp.status, settlement.ucp.startDate, settlement.ucp.expiryDate, now) ||
    settlement.feeDestinationAccount.status !== CatalogStatus.ACTIVE
  ) {
    return null;
  }

  return settlement.feeDestinationAccountId;
}

export async function resolveFeeDestinationAccountForProduct(
  productCode: ProductCode | string,
): Promise<string | null> {
  const now = new Date();
  const settlement = await prisma.settlementRequest.findFirst({
    where: {
      status: CatalogStatus.ACTIVE,
      feeDestinationAccountId: { not: null },
      product: { code: productCode },
      ucp: { unit: 'FEES' },
    },
    include: {
      product: true,
      ucp: true,
      feeDestinationAccount: true,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  if (!settlement?.feeDestinationAccountId || !settlement.feeDestinationAccount) {
    return null;
  }

  if (
    !isCatalogEntryActive(settlement.status, settlement.startDate, settlement.expiryDate, now) ||
    !isCatalogEntryActive(
      settlement.product.status,
      settlement.product.startDate,
      settlement.product.expiryDate,
      now,
    ) ||
    !isCatalogEntryActive(settlement.ucp.status, settlement.ucp.startDate, settlement.ucp.expiryDate, now) ||
    settlement.ucp.unit !== 'FEES' ||
    settlement.feeDestinationAccount.status !== CatalogStatus.ACTIVE
  ) {
    return null;
  }

  return settlement.feeDestinationAccountId;
}

export async function resolveFundHoldingAccount(
  productCode: ProductCode | string,
): Promise<string | null> {
  const now = new Date();
  const product = await prisma.product.findUnique({
    where: { code: productCode },
    include: { fundHoldingAccount: true },
  });

  if (!product?.fundHoldingAccountId || !product.fundHoldingAccount) {
    return null;
  }

  if (
    !isCatalogEntryActive(product.status, product.startDate, product.expiryDate, now) ||
    product.fundHoldingAccount.status !== CatalogStatus.ACTIVE
  ) {
    return null;
  }

  return product.fundHoldingAccountId;
}

export async function postFeeIncome(params: {
  productCode: ProductCode | string;
  ucpCode: UcpCode | string;
  amount: number;
  referenceType: string;
  referenceId: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<BusinessAccountTransaction | null> {
  if (params.amount <= 0) return null;

  const accountId = await resolveFeeDestinationAccount(params.productCode, params.ucpCode);
  if (!accountId) {
    log('No fee destination account configured', {
      productCode: params.productCode,
      ucpCode: params.ucpCode,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
    });
    return null;
  }

  return creditBusinessAccount({
    accountId,
    amount: params.amount,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    productCode: params.productCode,
    ucpCode: params.ucpCode,
    description: params.description,
    metadata: params.metadata,
  });
}

export async function postFundHolding(params: {
  productCode: ProductCode | string;
  amount: number;
  referenceType: string;
  referenceId: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<BusinessAccountTransaction | null> {
  if (params.amount <= 0) return null;

  const accountId = await resolveFundHoldingAccount(params.productCode);
  if (!accountId) {
    log('No fund holding account configured', {
      productCode: params.productCode,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
    });
    return null;
  }

  return creditBusinessAccount({
    accountId,
    amount: params.amount,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    productCode: params.productCode,
    description: params.description,
    metadata: params.metadata,
  });
}
