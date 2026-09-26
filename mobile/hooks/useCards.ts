import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { fetchCards, updateCardStatus, deleteCard } from '@/lib/api';
import type { CardsResponse, VirtualCardSummary } from '@/lib/types';

const PROVISION_POLL_MS = 2500;
const WEB_BALANCE_POLL_MS = 5000;
const PIN_BALANCE_MS = 20_000;

let inflightCards: Promise<CardsResponse> | null = null;
const provisionListeners = new Set<() => void>();
let provisionTimer: ReturnType<typeof setInterval> | null = null;
let appSub: ReturnType<typeof AppState.addEventListener> | null = null;

const webBalanceListeners = new Set<() => void>();
let webBalanceTimer: ReturnType<typeof setInterval> | null = null;
let webVisibilityHandler: (() => void) | null = null;

type CardSnapshot = {
  cards: VirtualCardSummary[];
  provisioning: CardsResponse['provisioning'];
  issuance: CardsResponse['issuance'];
  stripePublishableKey: string | null;
  stripeConnectedAccountId: string | null;
};

const emptyProvisioning: CardsResponse['provisioning'] = { status: 'none', error: null };
const emptyIssuance: CardsResponse['issuance'] = {
  feeUsd: 0,
  feeGmd: 0,
  exchangeRate: 71,
  required: false,
  expiryYears: 1,
  paid: false,
  paidAt: null,
  canReissue: false,
};

let snapshot: CardSnapshot | null = null;
const snapshotListeners = new Set<() => void>();

type PinnedBalance = {
  balanceUsd: number;
  balanceGmdEstimate: number;
  balanceSource: VirtualCardSummary['balanceSource'];
  until: number;
};

let pinnedBalance: PinnedBalance | null = null;

function loadCards(): Promise<CardsResponse> {
  if (!inflightCards) {
    inflightCards = fetchCards().finally(() => {
      inflightCards = null;
    });
  }
  return inflightCards;
}

async function loadCardsFresh(): Promise<CardsResponse> {
  const pending = inflightCards;
  if (pending) {
    try {
      await pending;
    } catch {
      // The follow-up request is the one this caller needs.
    }
  }
  return loadCards();
}

function emitSnapshot() {
  snapshotListeners.forEach((listener) => listener());
}

function isBalanceSource(value: string): value is VirtualCardSummary['balanceSource'] {
  return value === 'stripe' || value === 'simulated' || value === 'unavailable';
}

function overlayPin(cards: VirtualCardSummary[]): VirtualCardSummary[] {
  if (!pinnedBalance) return cards;
  if (Date.now() >= pinnedBalance.until) {
    pinnedBalance = null;
    return cards;
  }

  const index = cards.findIndex((card) => card.status !== 'canceled');
  if (index < 0) return cards;

  const current = cards[index];
  if (Math.round(current.balanceUsd * 100) === Math.round(pinnedBalance.balanceUsd * 100)) {
    pinnedBalance = null;
    return cards;
  }

  const next = cards.slice();
  next[index] = {
    ...current,
    balance: pinnedBalance.balanceUsd,
    balanceUsd: pinnedBalance.balanceUsd,
    balanceGmdEstimate: pinnedBalance.balanceGmdEstimate,
    balanceSource: pinnedBalance.balanceSource,
  };
  return next;
}

function commitCards(data: CardsResponse) {
  if (snapshotListeners.size === 0) return;
  snapshot = {
    cards: overlayPin(data.cards),
    provisioning: data.provisioning,
    issuance: data.issuance,
    stripePublishableKey: data.stripePublishableKey,
    stripeConnectedAccountId: data.stripeConnectedAccountId,
  };
  emitSnapshot();
}

function replaceCard(updated: VirtualCardSummary) {
  if (!snapshot) return;
  snapshot = {
    ...snapshot,
    cards: overlayPin(snapshot.cards.map((card) => (card.id === updated.id ? updated : card))),
  };
  emitSnapshot();
}

/** Keep every mounted card view on the balance returned by fund or withdraw. */
export function applyPrimaryCardBalance(balance: {
  balanceUsd: number;
  balanceGmdEstimate: number;
  balanceSource: string;
}) {
  if (!snapshot) return;
  pinnedBalance = {
    balanceUsd: balance.balanceUsd,
    balanceGmdEstimate: balance.balanceGmdEstimate,
    balanceSource: isBalanceSource(balance.balanceSource) ? balance.balanceSource : 'unavailable',
    until: Date.now() + PIN_BALANCE_MS,
  };
  snapshot = { ...snapshot, cards: overlayPin(snapshot.cards) };
  emitSnapshot();
}

function isPageVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function notifyProvisionListeners() {
  if (AppState.currentState !== 'active') return;
  provisionListeners.forEach((listener) => listener());
}

function startSharedCardPoll(onTick: () => void): () => void {
  provisionListeners.add(onTick);
  if (!provisionTimer) {
    provisionTimer = setInterval(notifyProvisionListeners, PROVISION_POLL_MS);
    appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') notifyProvisionListeners();
    });
  }
  return () => {
    provisionListeners.delete(onTick);
    if (provisionListeners.size === 0) {
      if (provisionTimer) {
        clearInterval(provisionTimer);
        provisionTimer = null;
      }
      appSub?.remove();
      appSub = null;
    }
  };
}

function startWebBalancePoll(onTick: () => void): () => void {
  webBalanceListeners.add(onTick);
  if (!webBalanceTimer && Platform.OS === 'web') {
    const tick = () => {
      if (!isPageVisible()) return;
      webBalanceListeners.forEach((listener) => listener());
    };
    webBalanceTimer = setInterval(tick, WEB_BALANCE_POLL_MS);
    if (typeof document !== 'undefined') {
      webVisibilityHandler = () => {
        if (document.visibilityState === 'visible') tick();
      };
      document.addEventListener('visibilitychange', webVisibilityHandler);
    }
  }
  return () => {
    webBalanceListeners.delete(onTick);
    if (webBalanceListeners.size === 0) {
      if (webBalanceTimer) {
        clearInterval(webBalanceTimer);
        webBalanceTimer = null;
      }
      if (webVisibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', webVisibilityHandler);
      }
      webVisibilityHandler = null;
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
  const [cards, setCards] = useState<VirtualCardSummary[]>(snapshot?.cards ?? []);
  const [provisioning, setProvisioning] = useState<CardsResponse['provisioning']>(
    snapshot?.provisioning ?? emptyProvisioning,
  );
  const [issuance, setIssuance] = useState<CardsResponse['issuance']>(
    snapshot?.issuance ?? emptyIssuance,
  );
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(
    snapshot?.stripePublishableKey ?? null,
  );
  const [stripeConnectedAccountId, setStripeConnectedAccountId] = useState<string | null>(
    snapshot?.stripeConnectedAccountId ?? null,
  );
  const [loading, setLoading] = useState(enabled && snapshot === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
  const hasLoadedRef = useRef(snapshot !== null);

  const applySnapshot = useCallback(() => {
    if (!snapshot) return;
    setCards(snapshot.cards);
    setProvisioning(snapshot.provisioning);
    setIssuance(snapshot.issuance);
    setStripePublishableKey(snapshot.stripePublishableKey);
    setStripeConnectedAccountId(snapshot.stripeConnectedAccountId);
    setLoading(false);
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    snapshotListeners.add(applySnapshot);
    applySnapshot();
    return () => {
      snapshotListeners.delete(applySnapshot);
      if (snapshotListeners.size === 0) {
        snapshot = null;
        pinnedBalance = null;
      }
    };
  }, [applySnapshot]);

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
      const data = silent ? await loadCards() : await loadCardsFresh();
      commitCards(data);
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

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    return startWebBalancePoll(() => {
      void refresh({ silent: true });
    });
  }, [enabled, refresh]);

  const freezeCard = useCallback(async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const updated = await updateCardStatus(cardId, 'inactive');
      replaceCard(updated);
    } finally {
      setUpdatingCardId(null);
    }
  }, []);

  const unfreezeCard = useCallback(async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const updated = await updateCardStatus(cardId, 'active');
      replaceCard(updated);
    } finally {
      setUpdatingCardId(null);
    }
  }, []);

  const removeCard = useCallback(async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const result = await deleteCard(cardId);
      replaceCard(result.card);
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
