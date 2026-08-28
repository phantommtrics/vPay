import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { formatCardBalance, formatMaskedCardBalance } from '@/lib/currency';

type CardBalanceRowProps = {
  balanceUsd: number;
};

export function CardBalanceRow({ balanceUsd }: CardBalanceRowProps) {
  const [showBalance, setShowBalance] = useState(false);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Available balance</Text>
      <View style={styles.valueRow}>
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}>
          {showBalance
            ? formatCardBalance(balanceUsd, 'usd')
            : formatMaskedCardBalance('usd')}
        </Text>
        <Pressable
          onPress={() => setShowBalance((visible) => !visible)}
          style={styles.eyeButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={showBalance ? 'Hide card balance' : 'Show card balance'}>
          {showBalance ? (
            <EyeOff size={18} color={colors.gray600} />
          ) : (
            <Eye size={18} color={colors.gray600} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  eyeButton: {
    padding: 4,
  },
});
