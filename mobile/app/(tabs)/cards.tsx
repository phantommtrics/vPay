import {
  ArrowRight,
  CheckCircle2,
  Plus,
  Settings2,
  ShieldAlert,
  Snowflake,
  Trash2,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PullToRefreshScrollView } from '@/components/PullToRefreshScrollView';
import { VirtualCard } from '@/components/VirtualCard';
import { useAuth } from '@/contexts/AuthContext';
import { useCards } from '@/hooks/useCards';
import { useWallet } from '@/hooks/useWallet';
import { ApiError, fundCardFromWallet, getFundConfig, payCardIssuance } from '@/lib/api';
import { formatCardBalance, formatGmd } from '@/lib/currency';
import { toFriendlyFundError } from '@/lib/fund-errors';
import { colors, radius, spacing } from '@/constants/theme';

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    primaryCard,
    provisioning,
    issuance,
    stripePublishableKey,
    stripeConnectedAccountId,
    loading,
    refreshing: cardsRefreshing,
    error,
    freezeCard,
    unfreezeCard,
    updatingCardId,
    refresh,
  } = useCards(Boolean(user?.kycComplete));
  const { wallet, refreshing: walletRefreshing, refresh: refreshWallet } = useWallet(
    Boolean(user?.kycComplete),
  );

  const refreshing = cardsRefreshing || walletRefreshing;

  const onRefresh = useCallback(async () => {
    if (!user?.kycComplete) return;
    await Promise.all([refresh(), refreshWallet()]);
  }, [refresh, refreshWallet, user?.kycComplete]);

  const [fundAmount, setFundAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState('');
  const [fundSuccess, setFundSuccess] = useState<{ gmd: number; usd: number } | null>(null);
  const [showFundPanel, setShowFundPanel] = useState(false);
  const [isReissuing, setIsReissuing] = useState(false);
  const [reissueError, setReissueError] = useState('');

  const numFundAmount = parseFloat(fundAmount) || 0;
  const fundUsdEstimate =
    exchangeRate && numFundAmount > 0 ? numFundAmount / exchangeRate : undefined;

  useEffect(() => {
    getFundConfig()
      .then((config) => setExchangeRate(config.exchangeRate))
      .catch(() => {});
  }, []);

  const isFrozen = primaryCard?.status === 'inactive';
  const isExpired = Boolean(primaryCard?.expired);
  const canReissue =
    issuance.canReissue && issuance.required && provisioning.status !== 'pending';

  const handleReissueCard = useCallback(async () => {
    setReissueError('');
    setIsReissuing(true);
    try {
      await payCardIssuance();
      await refresh();
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not reissue card';
      setReissueError(message);
    } finally {
      setIsReissuing(false);
    }
  }, [refresh]);

  const handleFreezeToggle = async () => {
    if (!primaryCard) return;
    if (isFrozen) {
      await unfreezeCard(primaryCard.id);
      return;
    }
    await freezeCard(primaryCard.id);
  };

  const handleFundCard = useCallback(async () => {
    if (numFundAmount <= 0 || isFunding || !primaryCard) return;

    if (!wallet) {
      setFundError('Top up your vPay wallet first from the Wallet tab.');
      return;
    }
    if (numFundAmount > wallet.balanceGmd) {
      setFundError('Amount exceeds your vPay wallet balance.');
      return;
    }

    setFundError('');
    setIsFunding(true);
    try {
      const result = await fundCardFromWallet(numFundAmount);
      await Promise.all([refresh(), refreshWallet()]);
      setFundAmount('');
      setFundSuccess({
        gmd: result.transaction.amountGmd,
        usd: result.transaction.amountUsd,
      });
    } catch (e) {
      const raw = e instanceof ApiError ? e.message : 'Could not fund your card';
      setFundError(toFriendlyFundError(raw));
    } finally {
      setIsFunding(false);
    }
  }, [numFundAmount, isFunding, primaryCard, wallet, refresh, refreshWallet]);

  if (fundSuccess) {
    return (
      <View style={[styles.successContainer, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.successIcon}>
          <CheckCircle2 size={40} color={colors.emerald600} />
        </View>
        <Text style={styles.successTitle}>Card funded</Text>
        <Text style={styles.successBody}>
          <Text style={styles.successAmount}>{formatGmd(fundSuccess.gmd)}</Text> moved from your
          wallet to your card (≈ ${fundSuccess.usd.toFixed(2)} USD).
        </Text>
        <Pressable
          style={styles.doneButton}
          onPress={() => {
            setFundSuccess(null);
            setFundError('');
            setShowFundPanel(false);
          }}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <PullToRefreshScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your Cards</Text>
          <Text style={styles.subtitle}>Manage your virtual cards</Text>
        </View>
        {primaryCard && !isExpired ? (
          <Pressable
            style={styles.fundCardButton}
            onPress={() => {
              setShowFundPanel((open) => !open);
              setFundError('');
            }}
            hitSlop={8}>
            <Text style={styles.fundCardButtonText}>
              {showFundPanel ? 'Close' : 'Fund card'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : primaryCard ? (
        <View>
          <VirtualCard
            card={primaryCard}
            stripePublishableKey={stripePublishableKey}
            stripeConnectedAccountId={stripeConnectedAccountId}
          />
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
          </View>
        </View>
      ) : (
        <Pressable style={styles.emptyCard} onPress={() => void refresh()}>
          <Text style={styles.emptyTitle}>No card available</Text>
          <Text style={styles.emptyBody}>
            {error ?? 'Complete verification and wait for card provisioning. Tap to refresh.'}
          </Text>
        </Pressable>
      )}

      {primaryCard && !isExpired && showFundPanel ? (
        <View style={styles.fundSection}>
          <Text style={styles.fundSectionTitle}>Fund card</Text>
          <Text style={styles.fundSectionHint}>
            Move GMD from your vPay wallet to your card balance.
          </Text>

          <View style={styles.balanceRow}>
            <View style={styles.balanceChip}>
              <Text style={styles.balanceChipLabel}>Card balance</Text>
              <Text style={styles.balanceChipValue}>
                {formatCardBalance(primaryCard.balanceUsd, primaryCard.currency)}
              </Text>
            </View>
            <View style={styles.balanceChip}>
              <Text style={styles.balanceChipLabel}>Wallet available</Text>
              <Text style={styles.balanceChipValue}>
                {wallet ? formatGmd(wallet.balanceGmd) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount (GMD)</Text>
            <View style={styles.amountInputRow}>
              <Text
                style={[
                  styles.currencySymbol,
                  numFundAmount > 0 && styles.currencySymbolActive,
                ]}>
                D
              </Text>
              <TextInput
                value={fundAmount}
                onChangeText={(v) => {
                  setFundAmount(v.replace(/[^0-9.]/g, ''));
                  setFundError('');
                }}
                keyboardType="decimal-pad"
                style={[styles.amountInput, !fundAmount && styles.amountInputPlaceholder]}
                placeholder="0"
                placeholderTextColor={colors.gray300}
                editable={!isFunding && Boolean(wallet)}
              />
            </View>
            {wallet ? (
              <Text style={styles.amountHint}>
                Available: {formatGmd(wallet.balanceGmd)}
                {fundUsdEstimate !== undefined && numFundAmount > 0
                  ? ` · ≈ $${fundUsdEstimate.toFixed(2)} USD to card`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.amountHint}>
                Top up your wallet from the Wallet tab before funding your card.
              </Text>
            )}
          </View>

          {fundError ? (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.errorBanner}>
              <XCircle size={18} color={colors.red500} />
              <Text style={styles.errorText}>{fundError}</Text>
            </Animated.View>
          ) : null}

          <Pressable
            style={[
              styles.fundButton,
              (numFundAmount <= 0 || isFunding || !wallet) && styles.fundButtonDisabled,
            ]}
            onPress={() => void handleFundCard()}
            disabled={numFundAmount <= 0 || isFunding || !wallet}>
            {isFunding ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.fundButtonText}>Fund card</Text>
                <ArrowRight size={20} color={colors.white} />
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.controls}>
        <ControlButton
          icon={Snowflake}
          label={isFrozen ? 'Unfreeze' : 'Freeze'}
          iconBg={isFrozen ? colors.blue100 : colors.gray100}
          iconColor={isFrozen ? colors.blue600 : colors.gray600}
          onPress={handleFreezeToggle}
          disabled={!primaryCard || isExpired || updatingCardId === primaryCard?.id}
        />
        <ControlButton
          icon={Settings2}
          label="Limits"
          iconBg={colors.gray100}
          iconColor={colors.gray600}
          disabled
        />
        <ControlButton
          icon={ShieldAlert}
          label="Security"
          iconBg={colors.gray100}
          iconColor={colors.gray600}
          disabled
        />
        <ControlButton
          icon={Trash2}
          label="Delete"
          iconBg={colors.red50}
          iconColor={colors.red500}
          labelColor={colors.red500}
          disabled
        />
      </View>

      <Pressable
        style={[styles.newCard, !canReissue && styles.newCardDisabled]}
        disabled={!canReissue || isReissuing}
        onPress={() => void handleReissueCard()}>
        <View style={styles.newCardIcon}>
          {isReissuing ? (
            <ActivityIndicator color={colors.emerald700} size="small" />
          ) : (
            <Plus size={18} color={colors.emerald700} />
          )}
        </View>
        <Text style={styles.newCardText}>
          {canReissue ? `Reissue card · ${formatGmd(issuance.feeGmd)}` : 'Generate New Card'}
        </Text>
      </Pressable>

      {reissueError ? <Text style={styles.reissueError}>{reissueError}</Text> : null}

      <Text style={styles.feeNote}>
        {canReissue
          ? 'Your previous card expired. Reissue to get a new virtual card.'
          : 'Additional cards will be available in a future update.'}
      </Text>
    </PullToRefreshScrollView>
  );
}

function ControlButton({
  icon: Icon,
  label,
  iconBg,
  iconColor,
  labelColor = colors.gray600,
  onPress,
  disabled,
}: {
  icon: typeof Snowflake;
  label: string;
  iconBg: string;
  iconColor: string;
  labelColor?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.controlButton, disabled && styles.controlDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <View style={[styles.controlIcon, { backgroundColor: iconBg }]}>
        <Icon size={20} color={iconColor} />
      </View>
      <Text style={[styles.controlLabel, { color: labelColor }]}>{label}</Text>
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
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  fundCardButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.emerald100,
    marginTop: 4,
  },
  fundCardButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
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
  loading: {
    aspectRatio: 1.586,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    aspectRatio: 1.586,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.emerald600,
  },
  fundSection: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 16,
  },
  fundSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  fundSectionHint: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: -8,
    fontFamily: 'Inter_400Regular',
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceChip: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  balanceChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Inter_600SemiBold',
  },
  balanceChipValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  amountCard: {
    alignItems: 'center',
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
    color: colors.gray300,
    fontFamily: 'Inter_700Bold',
  },
  currencySymbolActive: {
    color: colors.gray900,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.gray900,
    minWidth: 100,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  amountInputPlaceholder: {
    color: colors.gray300,
  },
  amountHint: {
    fontSize: 13,
    color: colors.gray400,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.red500,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald600,
    borderRadius: radius.lg,
    paddingVertical: 16,
  },
  fundButtonDisabled: {
    opacity: 0.5,
  },
  fundButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  controls: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  newCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.emerald100,
    backgroundColor: colors.emerald50,
  },
  newCardDisabled: {
    opacity: 0.6,
  },
  newCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.emerald200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
  },
  feeNote: {
    fontSize: 12,
    color: colors.gray400,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
  },
  reissueError: {
    fontSize: 13,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.emerald100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  successBody: {
    fontSize: 15,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  successAmount: {
    fontWeight: '700',
    color: colors.emerald700,
    fontFamily: 'Inter_700Bold',
  },
  doneButton: {
    marginTop: 8,
    backgroundColor: colors.emerald600,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
