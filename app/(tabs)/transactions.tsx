import { Filter, Search } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '@/components/TransactionRow';
import { colors, radius, spacing } from '@/constants/theme';
import { allTransactions } from '@/lib/data';

type FilterType = 'all' | 'purchase' | 'funding';

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const filtered = allTransactions.filter((tx) => {
    const matchesFilter = filter === 'all' || tx.type === filter;
    const matchesSearch =
      search === '' ||
      tx.merchant.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Transactions</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search
            size={18}
            color={colors.gray400}
            style={styles.searchIcon}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor={colors.gray400}
            style={styles.searchInput}
          />
        </View>
        <Pressable style={styles.filterButton}>
          <Filter size={18} color={colors.gray600} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}>
        {(['all', 'purchase', 'funding'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.pill, filter === f && styles.pillActive]}>
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.list}>
        {filtered.map((tx) => (
          <TransactionRow key={tx.id} transaction={tx} large />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  filterButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  pillActive: {
    backgroundColor: colors.gray900,
    borderColor: colors.gray900,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray600,
    fontFamily: 'Inter_500Medium',
  },
  pillTextActive: {
    color: colors.white,
  },
  list: {
    gap: 12,
  },
});
