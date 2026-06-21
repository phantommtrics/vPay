import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
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

import { colors, radius, spacing } from '@/constants/theme';
import {
  EXCHANGE_RATE,
  FEE_PERCENT,
  fundingSources,
} from '@/lib/data';

export default function FundScreen() {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('1000');
  const [source, setSource] = useState('aps');
  const [isSuccess, setIsSuccess] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const fee = numAmount * FEE_PERCENT;
  const totalGMD = numAmount + fee;
  const usdEquivalent = numAmount / EXCHANGE_RATE;

  const handleFund = () => {
    if (numAmount > 0) {
      setIsSuccess(true);
    }
  };

  if (isSuccess) {
    return (
      <View
        style={[
          styles.successContainer,
          { paddingTop: insets.top + spacing.xl },
        ]}>
        <View style={styles.successIcon}>
          <CheckCircle2 size={40} color={colors.emerald600} />
        </View>
        <Text style={styles.successTitle}>Funding Successful</Text>
        <Text style={styles.successBody}>
          Your virtual card has been credited with{' '}
          <Text style={styles.successAmount}>${usdEquivalent.toFixed(2)}</Text>.
        </Text>
        <Pressable
          style={styles.doneButton}
          onPress={() => setIsSuccess(false)}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View>
        <Text style={styles.title}>Add Funds</Text>
        <Text style={styles.subtitle}>Top up your virtual card instantly</Text>
      </View>

      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Enter Amount (GMD)</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.currencySymbol}>D</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor={colors.gray300}
          />
        </View>
        <View style={styles.usdBadge}>
          <Text style={styles.usdText}>≈ ${usdEquivalent.toFixed(2)} USD</Text>
        </View>
      </View>

      <View style={styles.sourceSection}>
        <Text style={styles.sourceTitle}>Select Source</Text>
        <View style={styles.sourceGrid}>
          {fundingSources.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSource(s.id)}
              style={[
                styles.sourceCard,
                source === s.id && styles.sourceCardActive,
              ]}>
              <View
                style={[styles.sourceIcon, { backgroundColor: s.color }]}>
                <Text style={styles.sourceIconText}>{s.icon}</Text>
              </View>
              <Text style={styles.sourceName}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.summary}>
        <SummaryRow label="Amount" value={`D ${numAmount.toFixed(2)}`} />
        <SummaryRow label="Fee (2%)" value={`D ${fee.toFixed(2)}`} />
        <SummaryRow
          label="Exchange Rate"
          value={`1 USD = ${EXCHANGE_RATE} GMD`}
        />
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotalLabel}>Total to Pay</Text>
          <Text style={styles.summaryTotalValue}>D {totalGMD.toFixed(2)}</Text>
        </View>
      </View>

      <Pressable
        style={[styles.fundButton, numAmount <= 0 && styles.fundButtonDisabled]}
        onPress={handleFund}
        disabled={numAmount <= 0}>
        <Text style={styles.fundButtonText}>Fund Card</Text>
        <ArrowRight size={20} color={colors.white} />
      </Pressable>
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  amountCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 8,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray400,
    fontFamily: 'Inter_700Bold',
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.gray900,
    minWidth: 120,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  usdBadge: {
    backgroundColor: colors.emerald50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: 8,
  },
  usdText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.emerald700,
    fontFamily: 'Inter_500Medium',
  },
  sourceSection: {
    gap: 12,
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 4,
  },
  sourceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  sourceCard: {
    flex: 1,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.gray100,
    backgroundColor: colors.white,
    gap: 12,
  },
  sourceCardActive: {
    borderColor: colors.emerald600,
    backgroundColor: 'rgba(236,253,245,0.5)',
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconText: {
    color: colors.white,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  summary: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray900,
    fontFamily: 'Inter_500Medium',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginTop: 4,
    paddingTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald600,
    fontFamily: 'Inter_700Bold',
  },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald600,
    paddingVertical: 16,
    borderRadius: radius.md,
    shadowColor: colors.emerald600,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fundButtonDisabled: {
    backgroundColor: colors.gray300,
    shadowOpacity: 0,
  },
  fundButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.emerald100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  successBody: {
    fontSize: 16,
    color: colors.gray500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  successAmount: {
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  doneButton: {
    marginTop: 32,
    width: '100%',
    backgroundColor: colors.gray100,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
});
