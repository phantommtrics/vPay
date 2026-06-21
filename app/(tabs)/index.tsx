import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '@/components/TransactionRow';
import { VirtualCard } from '@/components/VirtualCard';
import { colors, radius, spacing } from '@/constants/theme';
import { recentTransactions } from '@/lib/data';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>Modou J.</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MJ</Text>
        </View>
      </View>

      <VirtualCard
        balance={124.5}
        cardNumber="4242 4242 4242 1234"
        expiry="12/26"
        cvv="456"
      />

      <View style={styles.actions}>
        <QuickAction
          icon={ArrowDownLeft}
          label="Add Funds"
          bg={colors.emerald100}
          color={colors.emerald600}
          onPress={() => router.push('/fund')}
        />
        <QuickAction
          icon={Plus}
          label="New Card"
          bg={colors.amber100}
          color={colors.amber600}
          onPress={() => router.push('/cards')}
        />
        <QuickAction
          icon={ShieldCheck}
          label="Limits"
          bg={colors.teal100}
          color={colors.teal600}
          onPress={() => router.push('/profile')}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable
            style={styles.seeAll}
            onPress={() => router.push('/transactions')}>
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={16} color={colors.emerald600} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {recentTransactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function QuickAction({
  icon: Icon,
  label,
  bg,
  color,
  onPress,
}: {
  icon: typeof Plus;
  label: string;
  bg: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionItem} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Icon size={24} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.emerald100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarText: {
    color: colors.emerald700,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.emerald600,
    fontFamily: 'Inter_500Medium',
  },
  list: {
    gap: 16,
  },
});
