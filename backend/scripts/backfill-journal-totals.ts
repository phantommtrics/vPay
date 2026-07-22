import 'dotenv/config';

import { JournalAccountType } from '@prisma/client';

import { prisma } from '../src/db.js';

const EPSILON = 0.0001;
const BATCH_SIZE = 500;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type LineLite = {
  accountType: JournalAccountType;
  debit: number;
  credit: number;
};

/**
 * Recompute the balanced totals for an entry.
 *
 * Customer-wallet lines are treated as audit-only mirrors when the
 * business-account lines already balance among themselves (this matches the
 * runtime posting logic). In that case they are excluded from the stored
 * totals so the entry reads as balanced. Otherwise the wallet line is a real
 * posting and is included.
 */
function computeTotals(lines: LineLite[]): { totalDebit: number; totalCredit: number } {
  let bizDebit = 0;
  let bizCredit = 0;
  let walletDebit = 0;
  let walletCredit = 0;
  let hasWalletLine = false;

  for (const line of lines) {
    if (line.accountType === JournalAccountType.BUSINESS_ACCOUNT) {
      bizDebit += line.debit;
      bizCredit += line.credit;
    } else {
      hasWalletLine = true;
      walletDebit += line.debit;
      walletCredit += line.credit;
    }
  }

  const businessBalanced = Math.abs(bizDebit - bizCredit) < EPSILON;

  if (hasWalletLine && businessBalanced) {
    return { totalDebit: roundMoney(bizDebit), totalCredit: roundMoney(bizCredit) };
  }

  return {
    totalDebit: roundMoney(bizDebit + walletDebit),
    totalCredit: roundMoney(bizCredit + walletCredit),
  };
}

async function main(): Promise<void> {
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;

  for (;;) {
    const entries = await prisma.journalEntry.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        totalDebit: true,
        totalCredit: true,
        lineCount: true,
        lines: { select: { accountType: true, debit: true, credit: true } },
      },
    });

    if (entries.length === 0) break;

    for (const entry of entries) {
      scanned += 1;
      const { totalDebit, totalCredit } = computeTotals(entry.lines);
      const lineCount = entry.lines.length;

      const changed =
        Math.abs(totalDebit - entry.totalDebit) > EPSILON ||
        Math.abs(totalCredit - entry.totalCredit) > EPSILON ||
        lineCount !== entry.lineCount;

      if (changed) {
        await prisma.journalEntry.update({
          where: { id: entry.id },
          data: { totalDebit, totalCredit, lineCount },
        });
        updated += 1;
      }
    }

    cursor = entries[entries.length - 1]?.id;
    if (entries.length < BATCH_SIZE) break;
  }

  console.log(`Journal totals backfill complete. Scanned ${scanned}, updated ${updated}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
