import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, getWallet } from '@/lib/api';
import type { WalletSummary } from '@/lib/types';

type UseWalletResult = {
  wallet: WalletSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useWallet(enabled = true): UseWalletResult {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getWallet();
      setWallet(data.wallet);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setWallet(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load wallet');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { wallet, loading, refreshing, error, refresh };
}
