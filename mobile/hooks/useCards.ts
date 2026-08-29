import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { fetchCards, updateCardStatus, deleteCard } from '@/lib/api';
import type { CardsResponse, VirtualCardSummary } from '@/lib/types';

const POLL_INTERVAL_MS = 2500;

let inflightCards: Promise<CardsResponse> | null = null;
const pollListeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let appSub: ReturnType<typeof AppState.addEventListener> | null = null;

function loadCards(): Promise<CardsResponse> {
  if (!inflightCards) {
    inflightCards = fetchCards().finally(() => {
      inflightCards = null;
    });
  }
  return inflightCards;
}

function notifyPollListeners() {
  if (AppState.currentState !== 'active') return;
  pollListeners.forEach((listener) => listener());
}

function startSharedCardPoll(onTick: () => void): () => void {
  pollListeners.add(onTick);
  if (!pollTimer) {
    pollTimer = setInterval(notifyPollListeners, POLL_INTERVAL_MS);
    appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') notifyPollListeners();
    });
  }
  return () => {
    pollListeners.delete(onTick);
    if (pollListeners.size === 0) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      appSub?.remove();
      appSub = null;
    }
  };
}

type RefreshOptions = {
  silent?: boolean;
};

type UseCardsResult = {
  cards: VirtualCardSummary[];
  primaryCard: VirtualCardSummary | null;
  provisioning: CardsResponse['provisioning'];
  issuance: CardsResponse['issuance'];
  stripePublishableKey: string | null;
  stripeConnectedAccountId: string | null;
  loading: boolean;
  refreshing: boolean;
  waitingForCard: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  freezeCard: (cardId: string) => Promise<void>;
  unfreezeCard: (cardId: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<{
    balanceMovedGmd: number;
    balanceMovedUsd: number;
  }>;
  updatingCardId: string | null;
};

export function useCards(enabled = true): UseCardsResult {
  const [cards, setCards] = useState<VirtualCardSummary[]>([]);
  const [provisioning, setProvisioning] = useState<CardsResponse['provisioning']>({
    status: 'none',
    error: null,
  });
  const [issuance, setIssuance] = useState<CardsResponse['issuance']>({
    feeUsd: 0,
    feeGmd: 0,
    exchangeRate: 71,
    required: false,
    expiryYears: 1,
    paid: false,
    paidAt: null,
    canReissue: false,
  });
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
  const [stripeConnectedAccountId, setStripeConnectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!enabled) return;
    const silent = options?.silent === true;

    if (!silent) {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
    }

    try {
      const data = await loadCards();
      setCards(data.cards);
      setProvisioning(data.provisioning);
      setIssuance(data.issuance);
      setStripePublishableKey(data.stripePublishableKey);
      setStripeConnectedAccountId(data.stripeConnectedAccountId);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load cards');
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
      hasLoadedRef.current = true;
    }
  }, [enabled]);

  useRefreshOnFocus(refresh);

  const waitingForCard = enabled && provisioning.status === 'pending';

  useEffect(() => {
    if (!waitingForCard) return;
    return startSharedCardPoll(() => {
      void refresh({ silent: true });
    });
  }, [waitingForCard, refresh]);

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

  const removeCard = useCallback(async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const result = await deleteCard(cardId);
      setCards((current) => current.map((card) => (card.id === cardId ? result.card : card)));
      return {
        balanceMovedGmd: result.balanceMovedGmd,
        balanceMovedUsd: result.balanceMovedUsd,
      };
    } finally {
      setUpdatingCardId(null);
    }
  }, []);

  return {
    cards,
    primaryCard: cards.find((card) => card.status !== 'canceled') ?? null,
    provisioning,
    issuance,
    stripePublishableKey,
    stripeConnectedAccountId,
    loading,
    refreshing,
    waitingForCard,
    error,
    refresh,
    freezeCard,
    unfreezeCard,
    deleteCard: removeCard,
    updatingCardId,
  };
}
