import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchCards, updateCardStatus } from '@/lib/api';
import type { CardsResponse, VirtualCardSummary } from '@/lib/types';

type UseCardsResult = {
  cards: VirtualCardSummary[];
  primaryCard: VirtualCardSummary | null;
  provisioning: CardsResponse['provisioning'];
  stripePublishableKey: string | null;
  stripeConnectedAccountId: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  freezeCard: (cardId: string) => Promise<void>;
  unfreezeCard: (cardId: string) => Promise<void>;
  updatingCardId: string | null;
};

export function useCards(enabled = true): UseCardsResult {
  const [cards, setCards] = useState<VirtualCardSummary[]>([]);
  const [provisioning, setProvisioning] = useState<CardsResponse['provisioning']>({
    status: 'none',
    error: null,
  });
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
  const [stripeConnectedAccountId, setStripeConnectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
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
      const data = await fetchCards();
      setCards(data.cards);
      setProvisioning(data.provisioning);
      setStripePublishableKey(data.stripePublishableKey);
      setStripeConnectedAccountId(data.stripeConnectedAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const freezeCard = useCallback(async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const updated = await updateCardStatus(cardId, 'inactive');
      setCards((current) => current.map((card) => (card.id === cardId ? updated : card)));
    } finally {
      setUpdatingCardId(null);
    }
  }, []);

  const unfreezeCard = useCallback(async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const updated = await updateCardStatus(cardId, 'active');
      setCards((current) => current.map((card) => (card.id === cardId ? updated : card)));
    } finally {
      setUpdatingCardId(null);
    }
  }, []);

  return {
    cards,
    primaryCard: cards[0] ?? null,
    provisioning,
    stripePublishableKey,
    stripeConnectedAccountId,
    loading,
    refreshing,
    error,
    refresh,
    freezeCard,
    unfreezeCard,
    updatingCardId,
  };
}
