import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export type HistoryBalanceLine = {
  label: string;
  value: string;
};

export type HistoryEntry = {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
  amountLabel: string;
  amountTone: 'credit' | 'debit' | 'neutral';
  balanceLines: HistoryBalanceLine[];
};

type HistoryTransactionRowProps = {
  entry: HistoryEntry;
};

export function HistoryTransactionRow({ entry }: HistoryTransactionRowProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{entry.title}</Text>

      {entry.subtitle ? (
        <Text style={styles.subtitle}>{entry.subtitle}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.date}>{entry.date}</Text>
        <Text
          style={[
            styles.amount,
            entry.amountTone === 'credit' && styles.amountCredit,
            entry.amountTone === 'debit' && styles.amountDebit,
          ]}>
          {entry.amountLabel}
        </Text>
      </View>

      {entry.balanceLines.length > 0 ? (
        <View style={styles.balanceBlock}>
          {entry.balanceLines.map((line) => (
            <View key={`${entry.id}-${line.label}`} style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>{line.label}</Text>
              <Text style={styles.balanceValue}>{line.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    lineHeight: 21,
    flexWrap: 'wrap',
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
    flexWrap: 'wrap',
    fontFamily: 'Inter_400Regular',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  date: {
    fontSize: 12,
    color: colors.gray500,
    flexShrink: 1,
    fontFamily: 'Inter_400Regular',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    flexShrink: 0,
    fontFamily: 'Inter_700Bold',
  },
  amountCredit: {
    color: colors.emerald600,
  },
  amountDebit: {
    color: colors.gray900,
  },
  balanceBlock: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    gap: 8,
  },
  balanceRow: {
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Inter_600SemiBold',
  },
  balanceValue: {
    fontSize: 13,
    color: colors.gray800,
    lineHeight: 18,
    flexWrap: 'wrap',
    fontFamily: 'Inter_500Medium',
  },
});
