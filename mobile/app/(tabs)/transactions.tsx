import { Filter, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HistoryTransactionRow,
  type HistoryEntry,
} from '@/components/HistoryTransactionRow';
import { PullToRefreshFlatList } from '@/components/PullToRefreshFlatList';
import { useAuth } from '@/contexts/AuthContext';
import { getCardFundTransactions, getWalletTransactions } from '@/lib/api';
import { formatGmd, formatSignedGmd, formatUsd } from '@/lib/currency';
import { sanitizeUserFacingText } from '@/lib/user-facing-text';
import type { CardFundTransactionSummary, WalletTransactionSummary } from '@/lib/types';
import { colors, radius, spacing } from '@/constants/theme';

const PAGE_SIZE = 20;

type FilterType = 'all' | 'wallet' | 'card';

type HistoryItem = HistoryEntry & {
  category: 'wallet' | 'card';
  createdAt: string;
};

function formatTxDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function walletDepositSubtitle(tx: WalletTransactionSummary): string | undefined {
  if (tx.fundingSourceLabel) {
    return `Added from ${tx.fundingSourceLabel}`;
  }
  return 'Added to your vPay wallet';
}

function walletTxToEntry(tx: WalletTransactionSummary): HistoryItem {
  const isDeposit = tx.type === 'deposit';
  const isCardFund = tx.type === 'card_fund';
  const isCredit =
    isDeposit || (tx.type === 'adjustment' && tx.balanceAfterGmd > tx.balanceBeforeGmd);

  let title = 'Wallet adjustment';
  if (isDeposit) {
    title = tx.fundingSourceLabel
      ? `Wallet top-up · ${tx.fundingSourceLabel}`
      : 'Wallet top-up';
  } else if (isCardFund) {
    title = 'Transferred to card';
  } else if (tx.referenceType === 'card_fund_reversal') {
    title = 'Card funding refund';
  } else if (tx.description) {
    title = sanitizeUserFacingText(tx.description) ?? 'Wallet adjustment';
  }

  const reversalSubtitle =
    tx.referenceType === 'card_fund_reversal'
      ? 'Returned to your wallet — card funding could not be completed'
      : undefined;

  return {
    id: tx.id,
    category: 'wallet',
    createdAt: tx.createdAt,
    title,
    subtitle: isCardFund
      ? 'Debited from your vPay wallet'
      : isDeposit
        ? walletDepositSubtitle(tx)
        : reversalSubtitle,
    date: formatTxDate(tx.createdAt),
    amountLabel: formatSignedGmd(tx.amountGmd, isCredit),
    amountTone: isCredit ? 'credit' : 'debit',
    balanceLines: [
      {
        label: 'Wallet balance',
        value: `${formatGmd(tx.balanceBeforeGmd)}  →  ${formatGmd(tx.balanceAfterGmd)}`,
      },
    ],
  };
}

function cardFundTxToEntry(tx: CardFundTransactionSummary): HistoryItem {
  const failed = tx.status === 'failed';

  return {
    id: tx.id,
    category: 'card',
    createdAt: tx.createdAt,
    title: failed ? 'Card funding failed' : 'Card funded from wallet',
    subtitle: failed
      ? 'Your wallet was refunded'
      : `${formatUsd(tx.amountUsd)} added to your card`,
    date: formatTxDate(tx.createdAt),
    amountLabel: formatSignedGmd(tx.amountGmd, false),
    amountTone: 'debit',
    balanceLines: [
      {
        label: 'Card balance (USD)',
        value: `${formatUsd(tx.stripeBalanceBeforeUsd)}  →  ${formatUsd(tx.stripeBalanceAfterUsd)}`,
      },
      {
        label: 'Card balance (GMD est.)',
        value: `${formatGmd(tx.gmdEstimateBefore)}  →  ${formatGmd(tx.gmdEstimateAfter)}`,
      },
    ],
  };
}

function appendUnique<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [walletTxs, setWalletTxs] = useState<WalletTransactionSummary[]>([]);
  const [cardTxs, setCardTxs] = useState<CardFundTransactionSummary[]>([]);
  const [walletCursor, setWalletCursor] = useState<string | null>(null);
  const [cardCursor, setCardCursor] = useState<string | null>(null);
  const [walletHasMore, setWalletHasMore] = useState(false);
  const [cardHasMore, setCardHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const loadingMoreRef = useRef(false);

  const applyWalletPage = useCallback((transactions: WalletTransactionSummary[], nextCursor: string | null, replace: boolean) => {
    setWalletTxs((current) => (replace ? transactions : appendUnique(current, transactions)));
    setWalletCursor(nextCursor);
    setWalletHasMore(nextCursor !== null);
  }, []);

  const applyCardPage = useCallback((transactions: CardFundTransactionSummary[], nextCursor: string | null, replace: boolean) => {
    setCardTxs((current) => (replace ? transactions : appendUnique(current, transactions)));
    setCardCursor(nextCursor);
    setCardHasMore(nextCursor !== null);
  }, []);

  const fetchFirstPage = useCallback(async () => {
    const [walletData, cardData] = await Promise.all([
      getWalletTransactions({ limit: PAGE_SIZE }),
      getCardFundTransactions({ limit: PAGE_SIZE }),
    ]);
    applyWalletPage(walletData.transactions, walletData.nextCursor, true);
    applyCardPage(cardData.transactions, cardData.nextCursor, true);
  }, [applyCardPage, applyWalletPage]);

  const loadInitial = useCallback(async () => {
    if (!user?.kycComplete) return;
    setLoading(true);
    setError('');
    try {
      await fetchFirstPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [fetchFirstPage, user?.kycComplete]);

  const onRefresh = useCallback(async () => {
    if (!user?.kycComplete) return;
    setRefreshing(true);
    setError('');
    try {
      await fetchFirstPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    } finally {
      setRefreshing(false);
    }
  }, [fetchFirstPage, user?.kycComplete]);

  const loadMore = useCallback(async () => {
    if (!user?.kycComplete || loading || refreshing || loadingMoreRef.current) return;

    const wantWallet = filter === 'all' || filter === 'wallet';
    const wantCard = filter === 'all' || filter === 'card';
    const shouldLoadWallet = wantWallet && walletHasMore;
    const shouldLoadCard = wantCard && cardHasMore;
    if (!shouldLoadWallet && !shouldLoadCard) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const tasks: Promise<void>[] = [];

      if (shouldLoadWallet) {
        tasks.push(
          getWalletTransactions({ cursor: walletCursor ?? undefined, limit: PAGE_SIZE }).then(
            (data) => {
              applyWalletPage(data.transactions, data.nextCursor, false);
            },
          ),
        );
      }

      if (shouldLoadCard) {
        tasks.push(
          getCardFundTransactions({ cursor: cardCursor ?? undefined, limit: PAGE_SIZE }).then(
            (data) => {
              applyCardPage(data.transactions, data.nextCursor, false);
            },
          ),
        );
      }

      await Promise.all(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more transactions');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [
    applyCardPage,
    applyWalletPage,
    cardCursor,
    cardHasMore,
    filter,
    loading,
    refreshing,
    user?.kycComplete,
    walletCursor,
    walletHasMore,
  ]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const allEntries = useMemo(() => {
    const items = [
      ...walletTxs.map(walletTxToEntry),
      ...cardTxs.map(cardFundTxToEntry),
    ];
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [walletTxs, cardTxs]);

  const filtered = useMemo(
    () =>
      allEntries.filter((entry) => {
        const matchesFilter =
          filter === 'all' ||
          (filter === 'wallet' && entry.category === 'wallet') ||
          (filter === 'card' && entry.category === 'card');
        const haystack = [entry.title, entry.subtitle, entry.date]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesSearch = search === '' || haystack.includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
      }),
    [allEntries, filter, search],
  );

  const listHeader = (
    <View style={styles.header}>
      <Text style={styles.title}>Transactions</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={18} color={colors.gray400} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions"
            placeholderTextColor={colors.gray400}
            style={styles.searchInput}
          />
        </View>
        <Pressable style={styles.filterButton}>
          <Filter size={18} color={colors.gray600} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'wallet', 'card'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'wallet' ? 'Wallet' : 'Card funding'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const listEmpty = loading ? (
    <ActivityIndicator color={colors.emerald600} style={styles.centeredLoader} />
  ) : error ? (
    <Text style={styles.errorText}>{error}</Text>
  ) : (
    <Text style={styles.emptyText}>No transactions yet.</Text>
  );

  const listFooter =
    loadingMore && filtered.length > 0 ? (
      <ActivityIndicator color={colors.emerald600} style={styles.footerLoader} />
    ) : null;

  return (
    <PullToRefreshFlatList
      style={styles.container}
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <HistoryTransactionRow entry={item} />
        </View>
      )}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.xl,
          flexGrow: filtered.length === 0 ? 1 : undefined,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.35}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    gap: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  filterChipActive: {
    backgroundColor: colors.emerald600,
    borderColor: colors.emerald600,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray600,
    fontFamily: 'Inter_600SemiBold',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  row: {
    marginBottom: 12,
  },
  centeredLoader: {
    marginTop: 32,
  },
  footerLoader: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.gray500,
    marginTop: 32,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    textAlign: 'center',
    color: colors.red500,
    marginTop: 24,
    fontFamily: 'Inter_400Regular',
  },
});
