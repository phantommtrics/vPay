import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppStackHeader } from '@/components/AppStackScreen';
import { PullToRefreshFlatList } from '@/components/PullToRefreshFlatList';
import { SupportTicketRow } from '@/components/SupportTicketRow';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { listSupportTickets } from '@/lib/api';
import type { SupportTicketSummary } from '@/lib/types';
import { colors, spacing } from '@/constants/theme';

export default function MyTicketsScreen() {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(async (mode: 'focus' | 'refresh' = 'focus') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await listSupportTickets();
      setTickets(data.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(() => loadTickets('focus'));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <AppStackHeader title="Your tickets" />
      {loading && tickets.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.emerald600} />
          <Text style={styles.muted}>Loading tickets…</Text>
        </View>
      ) : (
        <PullToRefreshFlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => loadTickets('refresh')}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + spacing.xl },
            tickets.length === 0 ? styles.listEmpty : null,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <SupportTicketRow
              ticket={item}
              onPress={() => router.push(`/ticket/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text style={error ? styles.errorText : styles.muted}>
              {error || 'You have not sent any requests yet.'}
            </Text>
          }
        />
      )}
      {error && tickets.length > 0 ? <Text style={styles.bannerError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  bannerError: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    fontSize: 13,
    color: colors.red500,
    fontFamily: 'Inter_400Regular',
  },
});
