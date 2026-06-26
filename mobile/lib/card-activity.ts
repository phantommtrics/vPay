import type { Transaction } from '@/lib/data';
import type { CardFundTransactionSummary } from '@/lib/types';

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - txDay.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function cardFundTxToRecentActivity(tx: CardFundTransactionSummary): Transaction {
  const failed = tx.status === 'failed';

  return {
    id: tx.id,
    merchant: failed ? 'Card funding failed' : 'Card funded from wallet',
    amount: failed ? -tx.amountUsd : tx.amountUsd,
    date: formatActivityDate(tx.createdAt),
    type: 'funding',
    status: failed ? 'failed' : 'completed',
    icon: failed ? '↩️' : '💳',
  };
}
