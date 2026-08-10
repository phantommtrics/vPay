import {
  BusinessAccountTxnType,
  CatalogStatus,
  JournalAccountType,
  type JournalEntry,
  type Prisma,
} from '@prisma/client';

import { prisma } from '../db.js';
import { log } from '../logger.js';
import {
  BUSINESS_ACCOUNT_CODES,
  PRODUCT_CODES,
  UCP_CODES,
  type ProductCode,
  type UcpCode,
} from '../settlement/catalog-codes.js';
import {
  resolveFeeDestinationAccount,
  resolveFeeDestinationAccountForProduct,
  resolveFundHoldingAccount,
} from '../business-accounts/service.js';

const BALANCE_EPSILON = 0.0001;

export type JournalLineInput = {
  accountType: JournalAccountType;
  accountId: string;
  debit?: number;
  credit?: number;
  walletTransactionId?: string;
  productCode?: string;
  ucpCode?: string;
  description?: string;
  /** Mirror of wallet mutation — excluded from balance check when true. */
  auditOnly?: boolean;
};

export type PostJournalInput = {
  referenceType: string;
  referenceId: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  lines: JournalLineInput[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertBalanced(lines: JournalLineInput[]): void {
  const counted = lines.filter((line) => !line.auditOnly);
  const totalDebit = roundMoney(counted.reduce((sum, line) => sum + (line.debit ?? 0), 0));
  const totalCredit = roundMoney(counted.reduce((sum, line) => sum + (line.credit ?? 0), 0));

  if (Math.abs(totalDebit - totalCredit) > BALANCE_EPSILON) {
    throw new Error(`Journal entry is unbalanced: debits=${totalDebit}, credits=${totalCredit}`);
  }

  for (const line of counted) {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;
    if (debit < 0 || credit < 0) {
      throw new Error('Journal line amounts must be non-negative');
    }
    if (debit > 0 && credit > 0) {
      throw new Error('Journal line cannot have both debit and credit');
    }
    if (debit === 0 && credit === 0) {
      throw new Error('Journal line must have a debit or credit amount');
    }
  }
}

async function resolveBusinessAccountByCode(code: string): Promise<string | null> {
  const account = await prisma.businessAccount.findFirst({
    where: { code, status: CatalogStatus.ACTIVE },
    select: { id: true },
  });
  return account?.id ?? null;
}

export async function resolvePaymentsReceivedAccountId(): Promise<string | null> {
  return resolveBusinessAccountByCode(BUSINESS_ACCOUNT_CODES.PAYMENTS_RECEIVED);
}

export async function resolveCardFundingClearingAccountId(): Promise<string | null> {
  return resolveBusinessAccountByCode(BUSINESS_ACCOUNT_CODES.CARD_FUNDING_CLEARING);
}

async function applyBusinessAccountLine(
  tx: Prisma.TransactionClient,
  params: {
    journalEntryId: string;
    accountId: string;
    debit: number;
    credit: number;
    referenceType: string;
    referenceId: string;
    productCode?: string;
    ucpCode?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<string | null> {
  const amount = params.debit > 0 ? params.debit : params.credit;
  const type = params.debit > 0 ? BusinessAccountTxnType.DEBIT : BusinessAccountTxnType.CREDIT;

  const account = await tx.businessAccount.findUnique({ where: { id: params.accountId } });
  if (!account) {
    log('Business account not found for journal line', { accountId: params.accountId });
    return null;
  }
  if (account.status !== CatalogStatus.ACTIVE) {
    log('Business account inactive for journal line', { accountId: params.accountId });
    return null;
  }

  const balanceBefore = account.balance;
  const balanceAfter =
    type === BusinessAccountTxnType.CREDIT ? balanceBefore + amount : balanceBefore - amount;

  if (type === BusinessAccountTxnType.DEBIT && balanceAfter < -BALANCE_EPSILON) {
    log('Business account insufficient balance for journal line', {
      accountId: params.accountId,
      balanceBefore,
      amount,
    });
    return null;
  }

  const row = await tx.businessAccountTransaction.create({
    data: {
      accountId: params.accountId,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      productCode: params.productCode ?? null,
      ucpCode: params.ucpCode ?? null,
      description: params.description ?? null,
      metadata: params.metadata ?? undefined,
      journalEntryId: params.journalEntryId,
    },
  });

  await tx.businessAccount.update({
    where: { id: params.accountId },
    data: { balance: balanceAfter },
  });

  return row.id;
}

export async function postJournalEntry(input: PostJournalInput): Promise<JournalEntry | null> {
  if (input.lines.length < 2) {
    throw new Error('Journal entry requires at least two lines');
  }

  assertBalanced(input.lines);

  // Stored totals reflect the balanced double-entry postings only. Audit-only
  // mirror lines (e.g. the customer wallet side already handled by the wallet
  // service) are excluded so the entry reads as balanced in reports.
  const balancedLines = input.lines.filter((line) => !line.auditOnly);
  const totalDebit = roundMoney(balancedLines.reduce((sum, line) => sum + (line.debit ?? 0), 0));
  const totalCredit = roundMoney(balancedLines.reduce((sum, line) => sum + (line.credit ?? 0), 0));

  const existing = await prisma.journalEntry.findUnique({
    where: {
      referenceType_referenceId: {
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    },
    include: { lines: true },
  });
  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description ?? null,
        metadata: input.metadata ?? undefined,
        totalDebit,
        totalCredit,
        lineCount: input.lines.length,
      },
    });

    for (const [index, line] of input.lines.entries()) {
      const debit = roundMoney(line.debit ?? 0);
      const credit = roundMoney(line.credit ?? 0);

      let businessAccountTransactionId: string | null = null;
      if (line.accountType === JournalAccountType.BUSINESS_ACCOUNT) {
        businessAccountTransactionId = await applyBusinessAccountLine(tx, {
          journalEntryId: entry.id,
          accountId: line.accountId,
          debit,
          credit,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          productCode: line.productCode,
          ucpCode: line.ucpCode,
          description: line.description,
          metadata: input.metadata,
        });
      } else if (line.accountType === JournalAccountType.CUSTOMER_WALLET) {
        const wallet = await tx.vPayWallet.findUnique({ where: { id: line.accountId } });
        if (!wallet) {
          log('Customer wallet not found for journal line', { walletId: line.accountId });
        }
      }

      await tx.journalLine.create({
        data: {
          journalEntryId: entry.id,
          accountType: line.accountType,
          accountId: line.accountId,
          debit,
          credit,
          walletTransactionId: line.walletTransactionId ?? null,
          businessAccountTransactionId,
          sortOrder: index,
        },
      });
    }

    return entry;
  });
}

export async function postWalletTopupJournal(params: {
  fundingOrderId: string;
  walletId: string;
  walletTransactionId: string;
  amountGmd: number;
  feeGmd: number;
  totalGmd: number;
  productCode?: ProductCode;
  ucpCode?: UcpCode;
  metadata?: Prisma.InputJsonValue;
}): Promise<JournalEntry | null> {
  const { amountGmd, feeGmd, totalGmd } = params;
  if (totalGmd <= 0) return null;

  const paymentsReceivedId = await resolvePaymentsReceivedAccountId();
  if (!paymentsReceivedId) {
    log('Payments received clearing account not configured; skipping journal', {
      fundingOrderId: params.fundingOrderId,
    });
    return null;
  }

  const [feeAccountId, fundPoolId] = await Promise.all([
    resolveFeeDestinationAccount(
      params.productCode ?? PRODUCT_CODES.WALLET_TOPUP,
      params.ucpCode ?? UCP_CODES.WALLET_TOPUP_FEE_PERCENT,
    ),
    resolveFundHoldingAccount(params.productCode ?? PRODUCT_CODES.WALLET_TOPUP),
  ]);

  const feeRecognized = feeGmd > 0 && feeAccountId;
  const paymentsDebit = feeRecognized ? totalGmd : amountGmd;

  const lines: JournalLineInput[] = [
    {
      accountType: JournalAccountType.BUSINESS_ACCOUNT,
      accountId: paymentsReceivedId,
      debit: paymentsDebit,
      productCode: params.productCode ?? PRODUCT_CODES.WALLET_TOPUP,
      description: 'Payment received',
    },
    {
      accountType: JournalAccountType.CUSTOMER_WALLET,
      accountId: params.walletId,
      credit: amountGmd,
      walletTransactionId: params.walletTransactionId,
      productCode: params.productCode ?? PRODUCT_CODES.WALLET_TOPUP,
      description: 'Customer wallet credit',
      auditOnly: Boolean(fundPoolId),
    },
  ];

  if (fundPoolId) {
    lines.push({
      accountType: JournalAccountType.BUSINESS_ACCOUNT,
      accountId: fundPoolId,
      credit: amountGmd,
      productCode: params.productCode ?? PRODUCT_CODES.WALLET_TOPUP,
      description: 'Customer funds pool credit',
    });
  } else {
    log('Fund holding account not configured; pool credit omitted from journal', {
      fundingOrderId: params.fundingOrderId,
      amountGmd,
    });
  }

  if (feeRecognized) {
    lines.push({
      accountType: JournalAccountType.BUSINESS_ACCOUNT,
      accountId: feeAccountId,
      credit: feeGmd,
      productCode: params.productCode ?? PRODUCT_CODES.WALLET_TOPUP,
      ucpCode: params.ucpCode ?? UCP_CODES.WALLET_TOPUP_FEE_PERCENT,
      description: 'Wallet top-up fee income',
    });
  } else if (feeGmd > 0) {
    log('Fee destination account not configured; fee omitted from journal', {
      fundingOrderId: params.fundingOrderId,
      feeGmd,
    });
  }

  return postJournalEntry({
    referenceType: 'funding_order',
    referenceId: params.fundingOrderId,
    description: 'Wallet top-up',
    metadata: params.metadata,
    lines,
  });
}

export async function postCardIssuanceFeeJournal(params: {
  walletId: string;
  walletTransactionId: string;
  feeGmd: number;
  paymentId: string;
  productCode?: ProductCode;
  ucpCode?: UcpCode;
  metadata?: Prisma.InputJsonValue;
}): Promise<JournalEntry | null> {
  if (params.feeGmd <= 0) return null;

  const feeAccountId = await resolveFeeDestinationAccount(
    params.productCode ?? PRODUCT_CODES.CARD_ISSUANCE,
    params.ucpCode ?? UCP_CODES.CARD_ISSUANCE_FEE_USD,
  );
  if (!feeAccountId) {
    log('Fee destination account not configured; skipping issuance journal', {
      walletTransactionId: params.walletTransactionId,
    });
    return null;
  }

  return postJournalEntry({
    referenceType: 'wallet_transaction',
    referenceId: params.walletTransactionId,
    description: 'Card issuance fee',
    metadata: params.metadata,
    lines: [
      {
        accountType: JournalAccountType.CUSTOMER_WALLET,
        accountId: params.walletId,
        debit: params.feeGmd,
        walletTransactionId: params.walletTransactionId,
        productCode: params.productCode ?? PRODUCT_CODES.CARD_ISSUANCE,
        ucpCode: params.ucpCode ?? UCP_CODES.CARD_ISSUANCE_FEE_USD,
        description: 'Card issuance fee debit',
      },
      {
        accountType: JournalAccountType.BUSINESS_ACCOUNT,
        accountId: feeAccountId,
        credit: params.feeGmd,
        productCode: params.productCode ?? PRODUCT_CODES.CARD_ISSUANCE,
        ucpCode: params.ucpCode ?? UCP_CODES.CARD_ISSUANCE_FEE_USD,
        description: 'Card issuance fee income',
      },
    ],
  });
}

export async function postCardFundJournal(params: {
  walletId: string;
  walletTransactionId: string;
  cardFundTransactionId: string;
  amountGmd: number;
  feeGmd?: number;
  productCode?: ProductCode;
  ucpCode?: UcpCode;
  metadata?: Prisma.InputJsonValue;
}): Promise<JournalEntry | null> {
  const feeGmd = params.feeGmd ?? 0;
  const totalGmd = params.amountGmd + feeGmd;
  if (totalGmd <= 0) return null;

  const [clearingId, fundPoolId, feeAccountId] = await Promise.all([
    resolveCardFundingClearingAccountId(),
    resolveFundHoldingAccount(params.productCode ?? PRODUCT_CODES.CARD_FUND),
    feeGmd > 0
      ? resolveFeeDestinationAccountForProduct(params.productCode ?? PRODUCT_CODES.CARD_FUND)
      : Promise.resolve(null),
  ]);

  if (!clearingId) {
    log('Card funding clearing account not configured; skipping card fund journal', {
      cardFundTransactionId: params.cardFundTransactionId,
    });
    return null;
  }

  if (!fundPoolId) {
    log('Fund holding account not configured; skipping card fund journal', {
      cardFundTransactionId: params.cardFundTransactionId,
    });
    return null;
  }

  const lines: JournalLineInput[] = [
    {
      accountType: JournalAccountType.CUSTOMER_WALLET,
      accountId: params.walletId,
      debit: totalGmd,
      walletTransactionId: params.walletTransactionId,
      productCode: params.productCode ?? PRODUCT_CODES.CARD_FUND,
      description: 'Customer wallet debit',
      auditOnly: true,
    },
    {
      accountType: JournalAccountType.BUSINESS_ACCOUNT,
      accountId: fundPoolId,
      debit: totalGmd,
      productCode: params.productCode ?? PRODUCT_CODES.CARD_FUND,
      description: 'Customer funds pool debit',
    },
    {
      accountType: JournalAccountType.BUSINESS_ACCOUNT,
      accountId: clearingId,
      credit: params.amountGmd,
      productCode: params.productCode ?? PRODUCT_CODES.CARD_FUND,
      description: 'Card funding clearing',
    },
  ];

  if (feeGmd > 0 && feeAccountId) {
    lines.push({
      accountType: JournalAccountType.BUSINESS_ACCOUNT,
      accountId: feeAccountId,
      credit: feeGmd,
      productCode: params.productCode ?? PRODUCT_CODES.CARD_FUND,
      ucpCode: params.ucpCode ?? UCP_CODES.CARD_FUND_FEE_PERCENT,
      description: 'Card funding fee income',
    });
  } else if (feeGmd > 0) {
    log('Fee destination account not configured; fee omitted from card fund journal', {
      cardFundTransactionId: params.cardFundTransactionId,
      feeGmd,
    });
    lines[1].debit = params.amountGmd;
  }

  return postJournalEntry({
    referenceType: 'card_fund_transaction',
    referenceId: params.cardFundTransactionId,
    description: 'Card fund transfer',
    metadata: params.metadata,
    lines,
  });
}

/**
 * Admin account termination: remove remaining customer liability from the funds
 * pool and recognize it on the terminated-balances income account.
 *
 * Mirrors card-fund / fee posting:
 * - customer wallet debit (audit-only; wallet service already mutated balance)
 * - customer funds pool debit
 * - terminated-balances credit
 */
export async function postAccountTerminationJournal(params: {
  walletId: string;
  walletTransactionId: string;
  amountGmd: number;
  productCode?: ProductCode;
  ucpCode?: UcpCode;
  metadata?: Prisma.InputJsonValue;
}): Promise<JournalEntry | null> {
  if (params.amountGmd <= 0) return null;

  const productCode = params.productCode ?? PRODUCT_CODES.ACCOUNT_TERMINATION;
  const ucpCode = params.ucpCode ?? UCP_CODES.ACCOUNT_TERMINATION_FORFEITURE;

  const [fundPoolId, incomeAccountId] = await Promise.all([
    resolveFundHoldingAccount(productCode),
    resolveFeeDestinationAccount(productCode, ucpCode),
  ]);

  if (!fundPoolId) {
    log('Fund holding account not configured; skipping termination journal', {
      walletTransactionId: params.walletTransactionId,
      amountGmd: params.amountGmd,
    });
    return null;
  }

  if (!incomeAccountId) {
    log('Terminated balances income account not configured; skipping termination journal', {
      walletTransactionId: params.walletTransactionId,
      amountGmd: params.amountGmd,
    });
    return null;
  }

  return postJournalEntry({
    referenceType: 'wallet_transaction',
    referenceId: params.walletTransactionId,
    description: 'Admin account termination — wallet zero',
    metadata: params.metadata,
    lines: [
      {
        accountType: JournalAccountType.CUSTOMER_WALLET,
        accountId: params.walletId,
        debit: params.amountGmd,
        walletTransactionId: params.walletTransactionId,
        productCode,
        ucpCode,
        description: 'Customer wallet debit',
        auditOnly: true,
      },
      {
        accountType: JournalAccountType.BUSINESS_ACCOUNT,
        accountId: fundPoolId,
        debit: params.amountGmd,
        productCode,
        ucpCode,
        description: 'Customer funds pool debit',
      },
      {
        accountType: JournalAccountType.BUSINESS_ACCOUNT,
        accountId: incomeAccountId,
        credit: params.amountGmd,
        productCode,
        ucpCode,
        description: 'Terminated balances income',
      },
    ],
  });
}
