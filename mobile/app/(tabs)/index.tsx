import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowDownLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardBalanceRow } from '@/components/CardBalanceRow';
import { ExpandableVirtualCard } from '@/components/ExpandableVirtualCard';
import { PullToRefreshScrollView } from '@/components/PullToRefreshScrollView';
import { TransactionRow } from '@/components/TransactionRow';
import { useAuth } from '@/contexts/AuthContext';
import { useCardActivity } from '@/hooks/useCardActivity';
import { useCards } from '@/hooks/useCards';
import { ApiError, getUserDisplayName, getUserInitials, hasDisplayName, payCardIssuance } from '@/lib/api';
import { formatGmd } from '@/lib/currency';
import { colors, radius, spacing } from '@/constants/theme';
import { sanitizeUserFacingText } from '@/lib/user-facing-text';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const {
    primaryCard,
    provisioning,
    issuance,
    stripePublishableKey,
    stripeConnectedAccountId,
    loading: cardsLoading,
    refreshing: cardsRefreshing,
    error: cardsError,
    refresh,
    waitingForCard,
  } = useCards(Boolean(user?.kycComplete));
  const {
    transactions: cardActivity,
    loading: activityLoading,
    refreshing: activityRefreshing,
    error: activityError,
    refresh: refreshActivity,
  } = useCardActivity(Boolean(user?.kycComplete));
  const [refreshingUser, setRefreshingUser] = useState(false);
  const [issuingCard, setIssuingCard] = useState(false);
  const [issuanceError, setIssuanceError] = useState('');

  const refreshing = refreshingUser || cardsRefreshing || activityRefreshing;

  const onRefresh = useCallback(async () => {
    setRefreshingUser(true);
    try {
      const tasks: Promise<void>[] = [refreshUser()];
      if (user?.kycComplete) {
        tasks.push(refresh(), refreshActivity());
      }
      await Promise.all(tasks);
    } finally {
      setRefreshingUser(false);
    }
  }, [refreshUser, refresh, refreshActivity, user?.kycComplete]);

  const hasActiveCard = Boolean(primaryCard && !primaryCard.expired);

  const showIssueCardCta =
    user?.kycComplete &&
    !hasActiveCard &&
    provisioning.status !== 'pending' &&
    issuance.required &&
    (!issuance.paid || issuance.canReissue);

  const issueCardLabel = issuance.canReissue ? 'Reissue card' : 'Issue card';

  const handleIssueCard = async () => {
    setIssuanceError('');
    setIssuingCard(true);
    try {
      await payCardIssuance();
      await refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not issue card';
      setIssuanceError(message);
    } finally {
      setIssuingCard(false);
    }
  };

  if (!user) return null;

  const showGreeting = hasDisplayName(user);
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);

  return (
    <PullToRefreshScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {!user.kycComplete ? (
        <Pressable
          style={styles.verifyBanner}
          onPress={() => router.push('/personal-details')}>
          <View style={styles.verifyIcon}>
            <AlertCircle size={20} color={colors.amber600} />
          </View>
          <View style={styles.verifyContent}>
            <Text style={styles.verifyTitle}>
              {user.kycStatus === 'pending'
                ? 'Verification in progress'
                : user.kycStatus === 'rejected'
                  ? 'Verification rejected'
                  : 'Complete your account'}
            </Text>
            <Text style={styles.verifyBody}>
              {user.kycStatus === 'pending'
                ? 'Your documents are being reviewed.'
                : user.kycStatus === 'rejected'
                  ? 'Update your details and resubmit for approval.'
                  : 'Verify your identity to unlock full card features.'}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.amber600} />
        </Pressable>
      ) : null}

      {user.kycComplete && waitingForCard ? (
        <View style={styles.provisioningBanner}>
          <ActivityIndicator color={colors.emerald600} />
          <View style={styles.verifyContent}>
            <Text style={styles.provisioningTitle}>Your card is being issued</Text>
            <Text style={styles.verifyBody}>
              This usually takes a moment. Your card will appear here when it is ready.
            </Text>
          </View>
        </View>
      ) : null}

      {user.kycComplete && provisioning.status === 'failed' ? (
        <View style={styles.failedBanner}>
          <AlertCircle size={20} color={colors.red500} />
          <View style={styles.verifyContent}>
            <Text style={styles.failedTitle}>Card provisioning failed</Text>
            <Text style={styles.verifyBody}>
              {sanitizeUserFacingText(provisioning.error) ?? 'Contact support if this continues.'}
            </Text>
          </View>
        </View>
      ) : null}

      {showGreeting && displayName && initials ? (
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      ) : null}

      {cardsLoading && user.kycComplete ? (
        <View style={styles.cardLoading}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : primaryCard ? (
        <View style={styles.cardSection}>
          <ExpandableVirtualCard
            card={primaryCard}
            stripePublishableKey={stripePublishableKey}
            stripeConnectedAccountId={stripeConnectedAccountId}
          />
          <CardBalanceRow balanceUsd={primaryCard.balanceUsd} />
          {primaryCard.expired && showIssueCardCta ? (
            <View style={styles.reissuePanel}>
              <Text style={styles.reissueBody}>
                This card expired. Reissue for {formatGmd(issuance.feeGmd)} (
                {issuance.feeUsd.toFixed(2)} USD) from your wallet.
              </Text>
              {issuanceError ? <Text style={styles.issuanceError}>{issuanceError}</Text> : null}
              <Pressable
                style={[styles.issueCardButton, issuingCard && styles.issueCardButtonDisabled]}
                disabled={issuingCard}
                onPress={() => void handleIssueCard()}>
                {issuingCard ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.issueCardButtonText}>
                    {issueCardLabel} · {formatGmd(issuance.feeGmd)}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : user.kycComplete && waitingForCard ? (
        <View style={styles.cardLoading}>
          <ActivityIndicator color={colors.emerald600} />
        </View>
      ) : user.kycComplete ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardTitle}>No card yet</Text>
          <Text style={styles.emptyCardBody}>
            {cardsError ??
              (showIssueCardCta
                ? `${issueCardLabel} for ${formatGmd(issuance.feeGmd)} (${issuance.feeUsd.toFixed(2)} USD) from your wallet.`
                : 'Your virtual card will appear here once provisioning completes.')}
          </Text>
          {issuanceError ? <Text style={styles.issuanceError}>{issuanceError}</Text> : null}
          {showIssueCardCta ? (
            <Pressable
              style={[styles.issueCardButton, issuingCard && styles.issueCardButtonDisabled]}
              disabled={issuingCard}
              onPress={() => void handleIssueCard()}>
              {issuingCard ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.issueCardButtonText}>
                  {issueCardLabel} · {formatGmd(issuance.feeGmd)}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardTitle}>Virtual card preview</Text>
          <Text style={styles.emptyCardBody}>
            Complete verification to unlock your virtual card.
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <QuickAction
          icon={ArrowDownLeft}
          label="Top up wallet"
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
          {activityLoading ? (
            <ActivityIndicator color={colors.emerald600} style={styles.activityLoader} />
          ) : activityError ? (
            <Text style={styles.activityEmpty}>{activityError}</Text>
          ) : cardActivity.length === 0 ? (
            <Text style={styles.activityEmpty}>
              {user.kycComplete
                ? 'No card activity yet. Fund your card from the Cards tab.'
                : 'Complete verification to see card activity.'}
            </Text>
          ) : (
            cardActivity.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          )}
        </View>
      </View>
    </PullToRefreshScrollView>
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
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
    marginBottom: -16,
  },
  provisioningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald100,
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
    marginBottom: -16,
  },
  failedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
    marginBottom: -16,
  },
  verifyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyContent: {
    flex: 1,
  },
  verifyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  provisioningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.emerald800,
    fontFamily: 'Inter_700Bold',
  },
  failedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red500,
    fontFamily: 'Inter_700Bold',
  },
  verifyBody: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
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
  cardLoading: {
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
  cardSection: {
    gap: 16,
  },
  reissuePanel: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber100,
    padding: 16,
    gap: 12,
  },
  reissueBody: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  emptyCardBody: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  issuanceError: {
    fontSize: 13,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  issueCardButton: {
    marginTop: 8,
    backgroundColor: colors.emerald600,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 180,
    alignItems: 'center',
  },
  issueCardButtonDisabled: {
    opacity: 0.7,
  },
  issueCardButtonText: {
    color: colors.white,
    fontSize: 14,
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
  activityLoader: {
    marginVertical: 16,
  },
  activityEmpty: {
    textAlign: 'center',
    color: colors.gray500,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 16,
    fontFamily: 'Inter_400Regular',
  },
});
