import { useCallback, useRef, useState } from 'react';

import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCardFundTransactions } from '@/lib/api';
import { cardFundTxToRecentActivity } from '@/lib/card-activity';
import type { Transaction } from '@/lib/data';

type UseCardActivityResult = {
  transactions: Transaction[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useCardActivity(enabled = true, limit = 5): UseCardActivityResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setTransactions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getCardFundTransactions({ limit });
      setTransactions(data.transactions.map(cardFundTxToRecentActivity));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [enabled, limit]);

  useRefreshOnFocus(refresh);

  return { transactions, loading, refreshing, error, refresh };
}
