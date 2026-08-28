import { CreditCard, Wallet } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { formatAmount, type Transaction } from '@/lib/data';
import { colors, radius } from '@/constants/theme';

type TransactionRowProps = {
  transaction: Transaction;
  large?: boolean;
};

const LUCIDE_ROW_ICONS = {
  wallet: Wallet,
  card: CreditCard,
} as const;

export function TransactionRow({ transaction, large }: TransactionRowProps) {
  const isCredit = transaction.amount > 0;
  const LucideIcon =
    transaction.icon in LUCIDE_ROW_ICONS
      ? LUCIDE_ROW_ICONS[transaction.icon as keyof typeof LUCIDE_ROW_ICONS]
      : null;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, large && styles.iconWrapLarge]}>
          {LucideIcon ? (
            <LucideIcon size={large ? 22 : 18} color={colors.gray600} strokeWidth={2} />
          ) : (
            <Text style={[styles.icon, large && styles.iconLarge]}>
              {transaction.icon}
            </Text>
          )}
        </View>
        <View>
          <Text style={styles.merchant}>{transaction.merchant}</Text>
          <Text style={styles.date}>{transaction.date}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text
          style={[
            styles.amount,
            isCredit ? styles.amountCredit : styles.amountDebit,
          ]}>
          {formatAmount(transaction.amount)}
        </Text>
        {transaction.status && (
          <Text style={styles.status}>{transaction.status}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  icon: {
    fontSize: 18,
  },
  iconLarge: {
    fontSize: 22,
  },
  merchant: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  date: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  amountCredit: {
    color: colors.emerald600,
  },
  amountDebit: {
    color: colors.gray900,
  },
  status: {
    fontSize: 10,
    color: colors.gray400,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});
