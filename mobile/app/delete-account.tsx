import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { AlertCircle, ArrowLeft, Trash2 } from 'lucide-react-native';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { ACCOUNT_DELETE_CONFIRMATION, ApiError, getWallet } from '@/lib/api';
import { colors, radius, spacing } from '@/constants/theme';

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { deleteAccount } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [balanceGmd, setBalanceGmd] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadWallet = useCallback(async () => {
    setLoadingWallet(true);
    setWalletError('');
    try {
      const data = await getWallet();
      setBalanceGmd(data.wallet.balanceGmd);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setBalanceGmd(0);
      } else {
        setBalanceGmd(null);
        setWalletError(err instanceof Error ? err.message : 'Failed to load wallet');
      }
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const walletBlocked = balanceGmd !== null && balanceGmd > 0;
  const walletReady = !loadingWallet && !walletError && !walletBlocked && balanceGmd !== null;
  const confirmationMatches =
    confirmation.trim().toUpperCase() === ACCOUNT_DELETE_CONFIRMATION;
  const canSubmit = walletReady && confirmationMatches && !submitting;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await deleteAccount(ACCOUNT_DELETE_CONFIRMATION);
      router.replace('/onboarding');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete account');
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.gray900} />
        </Pressable>
        <Text style={styles.screenTitle}>Delete Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.warningCard}>
          <AlertCircle size={22} color={colors.red500} />
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>This action is permanent</Text>
            <Text style={styles.warningBody}>
              Deleting your account cannot be undone. Your account will be terminated and you will
              lose access to your wallet, cards, and history. If you sign in again later with the
              same email, you will start as a new user.
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Before you continue</Text>
          <Text style={styles.bullet}>
            Your vPay wallet balance must be zero. Spend any remaining balance (for example by
            funding your card) or contact support.
          </Text>
          <Text style={styles.bullet}>
            Your virtual card(s) will be frozen automatically. Any remaining card balance cannot be
            used after deletion.
          </Text>
        </View>

        {loadingWallet ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.emerald600} />
            <Text style={styles.loadingText}>Checking wallet balance…</Text>
          </View>
        ) : walletError ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>Could not verify wallet</Text>
            <Text style={styles.blockBody}>{walletError}</Text>
            <Pressable style={styles.secondaryButton} onPress={loadWallet}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : walletBlocked ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>Wallet balance must be zero</Text>
            <Text style={styles.blockBody}>
              You still have D{balanceGmd!.toFixed(2)} in your vPay wallet. Spend the remaining
              balance (for example by funding your card) or contact support before deleting your
              account.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(tabs)/fund')}>
              <Text style={styles.secondaryButtonText}>Go to Fund</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.okCard}>
              <Text style={styles.okText}>Wallet balance is zero. You can continue.</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Confirm deletion</Text>
              <Text style={styles.confirmHint}>
                Type <Text style={styles.confirmPhrase}>{ACCOUNT_DELETE_CONFIRMATION}</Text> to
                confirm.
              </Text>
              <TextInput
                style={styles.input}
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                spellCheck={false}
                editable={!submitting}
                placeholder={ACCOUNT_DELETE_CONFIRMATION}
                placeholderTextColor={colors.gray400}
              />
            </View>

            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

            <Pressable
              style={[styles.deleteButton, !canSubmit && styles.deleteButtonDisabled]}
              onPress={handleDelete}
              disabled={!canSubmit}>
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Trash2 size={18} color={colors.white} />
                  <Text style={styles.deleteButtonText}>Delete my account</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: 16,
  },
  warningCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningCopy: {
    flex: 1,
    gap: 6,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  warningBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray600,
    fontFamily: 'Inter_400Regular',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray600,
    fontFamily: 'Inter_400Regular',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  blockCard: {
    backgroundColor: colors.amber100,
    borderRadius: radius.md,
    padding: 16,
    gap: 10,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  blockBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray700,
    fontFamily: 'Inter_400Regular',
  },
  okCard: {
    backgroundColor: colors.emerald50,
    borderRadius: radius.md,
    padding: 14,
  },
  okText: {
    fontSize: 14,
    color: colors.emerald700,
    fontFamily: 'Inter_500Medium',
  },
  confirmHint: {
    fontSize: 14,
    color: colors.gray600,
    fontFamily: 'Inter_400Regular',
  },
  confirmPhrase: {
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    color: colors.gray900,
    backgroundColor: colors.white,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    fontSize: 14,
    color: colors.red500,
    fontFamily: 'Inter_400Regular',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red500,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: 4,
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
    fontFamily: 'Inter_600SemiBold',
  },
});
