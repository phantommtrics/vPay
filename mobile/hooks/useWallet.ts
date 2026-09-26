import { useCallback, useEffect, useRef, useState } from 'react';

import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ApiError, getWallet } from '@/lib/api';
import type { WalletSummary } from '@/lib/types';

type UseWalletResult = {
  wallet: WalletSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

let sharedWallet: WalletSummary | null = null;
let sharedWalletLoaded = false;
const walletListeners = new Set<() => void>();

function commitWallet(wallet: WalletSummary | null) {
  if (walletListeners.size === 0) return;
  sharedWallet = wallet;
  sharedWalletLoaded = true;
  walletListeners.forEach((listener) => listener());
}

export function useWallet(enabled = true): UseWalletResult {
  const [wallet, setWallet] = useState<WalletSummary | null>(sharedWalletLoaded ? sharedWallet : null);
  const [loading, setLoading] = useState(enabled && !sharedWalletLoaded);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(sharedWalletLoaded);

  const applySharedWallet = useCallback(() => {
    if (!sharedWalletLoaded) return;
    setWallet(sharedWallet);
    setLoading(false);
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    walletListeners.add(applySharedWallet);
    applySharedWallet();
    return () => {
      walletListeners.delete(applySharedWallet);
      if (walletListeners.size === 0) {
        sharedWallet = null;
        sharedWalletLoaded = false;
      }
    };
  }, [applySharedWallet]);

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
      commitWallet(data.wallet);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        commitWallet(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load wallet');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [enabled]);

  useRefreshOnFocus(refresh);

  return { wallet, loading, refreshing, error, refresh };
}
