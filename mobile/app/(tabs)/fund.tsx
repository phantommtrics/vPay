import { ArrowRight, CheckCircle2, ChevronLeft, Smartphone, XCircle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PullToRefreshScrollView } from '@/components/PullToRefreshScrollView';
import { OtpInput, type OtpInputRef } from '@/components/OtpInput';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import {
  ApiError,
  authorizeFundAps,
  completeFundAps,
  getFundConfig,
  getFundingOrder,
  prepareFund,
  simulateFund,
  startFundWallet,
} from '@/lib/api';
import { fundingSources } from '@/lib/data';
import { formatGmd } from '@/lib/currency';
import {
  estimateWalletTopupFee,
  formatWalletTopupFeeLabel,
  type FundConfig,
  type WalletTopupFeePricing,
} from '@/lib/fund-config';
import { toFriendlyFundError } from '@/lib/fund-errors';
import type { CheckoutWallet, FundPrepareResponse } from '@/lib/types';
import { colors, radius, spacing } from '@/constants/theme';

function pickWalletForSource(wallets: CheckoutWallet[], sourceId: string): CheckoutWallet | null {
  const needle = sourceId.toLowerCase();
  return (
    wallets.find((w) => w.code.toLowerCase().includes(needle)) ??
    wallets.find((w) => w.name.toLowerCase().includes(needle)) ??
    null
  );
}

type FundFlowStep = 'main' | 'amount' | 'checkout';

type ApsCheckoutSession = {
  fundingId: string;
  prepare: FundPrepareResponse;
  authState: string;
  gatewayCode: string;
};

function amountsMatch(stored: number, entered: number): boolean {
  return Math.abs(stored - entered) < 0.001;
}

export default function FundScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { wallet, loading: walletLoading, refreshing: walletRefreshing, refresh: refreshWallet } =
    useWallet(Boolean(user?.kycComplete));
  const [flowStep, setFlowStep] = useState<FundFlowStep>('main');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('aps');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successGmd, setSuccessGmd] = useState(0);
  const [successUsd, setSuccessUsd] = useState(0);
  const [apsMobile, setApsMobile] = useState('');
  const [apsOtp, setApsOtp] = useState('');
  const [apsStep, setApsStep] = useState<'idle' | 'otp'>('idle');
  const [apsAuthState, setApsAuthState] = useState('');
  const [apsGatewayCode, setApsGatewayCode] = useState('');
  const [pendingPrepare, setPendingPrepare] = useState<FundPrepareResponse | null>(null);
  const [fundConfig, setFundConfig] = useState<FundConfig | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRef = useRef<OtpInputRef>(null);
  const prepareRef = useRef<FundPrepareResponse | null>(null);
  const apsSessionRef = useRef<ApsCheckoutSession | null>(null);
  const fundInFlightRef = useRef(false);

  const clearApsSession = useCallback(() => {
    apsSessionRef.current = null;
    setApsStep('idle');
    setApsOtp('');
    setApsAuthState('');
    setApsGatewayCode('');
  }, []);

  const resetCheckout = useCallback(() => {
    prepareRef.current = null;
    setPendingPrepare(null);
    clearApsSession();
  }, [clearApsSession]);

  const exchangeRate = pendingPrepare?.exchangeRate ?? fundConfig?.exchangeRate;
  const numAmount = parseFloat(amount) || 0;
  const walletTopupFee: WalletTopupFeePricing | undefined =
    fundConfig?.walletTopupFee ??
    (fundConfig?.feePercent != null ? { type: 'fixed', feePercent: fundConfig.feePercent } : undefined);
  const simulationEnabled = fundConfig?.simulationEnabled ?? pendingPrepare?.simulationEnabled ?? false;
  const feeLabel =
    pendingPrepare != null && pendingPrepare.funding.amountGmd > 0
      ? formatWalletTopupFeeLabel(
          walletTopupFee ?? { type: 'fixed', feePercent: pendingPrepare.feePercent },
          pendingPrepare.funding.amountGmd,
        )
      : walletTopupFee
        ? formatWalletTopupFeeLabel(walletTopupFee, numAmount)
        : '—';

  const fee =
    pendingPrepare?.funding.feeGmd ??
    (walletTopupFee && numAmount > 0 ? estimateWalletTopupFee(walletTopupFee, numAmount) : undefined);
  const totalGMD =
    pendingPrepare?.funding.totalGmd ??
    (fee !== undefined ? numAmount + fee : undefined);
  const usdEquivalent =
    pendingPrepare?.funding.usdEstimate ??
    (exchangeRate && numAmount > 0 ? numAmount / exchangeRate : undefined);

  const refreshBalances = useCallback(async () => {
    await refreshWallet();
  }, [refreshWallet]);

  const onRefresh = useCallback(async () => {
    const tasks: Promise<void>[] = [refreshWallet()];
    tasks.push(
      getFundConfig()
        .then((config) => setFundConfig(config))
        .catch(() => {}),
    );
    await Promise.all(tasks);
  }, [refreshWallet]);

  const clearError = () => setError('');

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    let cancelled = false;
    getFundConfig()
      .then((config) => {
        if (!cancelled) setFundConfig(config);
      })
      .catch(() => {
        // Config is optional until checkout; prepare returns authoritative values.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pollUntilPaid = useCallback(
    async (fundingId: string, gmd: number, usd: number) => {
      stopPolling();
      const started = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const { funding } = await getFundingOrder(fundingId);
          if (funding.status === 'paid') {
            stopPolling();
            setIsLoading(false);
            setApsStep('idle');
            resetCheckout();
            await refreshBalances();
            setSuccessGmd(gmd);
            setSuccessUsd(usd);
            setIsSuccess(true);
          } else if (funding.status === 'failed' || funding.status === 'cancelled') {
            stopPolling();
            setIsLoading(false);
            setError('Your payment could not be completed. Please try again.');
          } else if (Date.now() - started > 120_000) {
            stopPolling();
            setIsLoading(false);
            setError('Payment is still pending. If you completed it in your wallet, check back shortly.');
          }
        } catch {
          // keep polling
        }
      }, 3000);
    },
    [stopPolling, refreshBalances],
  );

  const runWalletCheckout = async (prepare: FundPrepareResponse, wallet: CheckoutWallet) => {
    const checkout = await startFundWallet(prepare.funding.id, {
      gatewayCode: wallet.code,
      gatewayId: wallet.gatewayId,
    });
    const opened = await Linking.openURL(checkout.launchUrl).catch(() => false);
    if (!opened) {
      Alert.alert('Open payment', 'Complete the payment in your wallet app or browser.', [
        { text: 'Open', onPress: () => Linking.openURL(checkout.launchUrl) },
        { text: 'OK' },
      ]);
    }
    await pollUntilPaid(prepare.funding.id, prepare.funding.amountGmd, prepare.funding.usdEstimate);
  };

  const selectSource = (sourceId: string) => {
    clearError();
    setSource(sourceId);
    clearApsSession();
    if (sourceId === 'aps' && user?.phone) {
      setApsMobile(user.phone);
    }
  };

  const goBackToMain = () => {
    clearError();
    setFlowStep('main');
    resetCheckout();
  };

  const goBackToAmount = () => {
    clearError();
    setFlowStep('amount');
    resetCheckout();
  };

  const confirmAmount = () => {
    if (numAmount <= 0) {
      setError('Please enter how much you want to add in GMD.');
      return;
    }
    clearError();
    setFlowStep('checkout');
    if (source === 'aps' && user?.phone && !apsMobile.trim()) {
      setApsMobile(user.phone);
    }
  };

  const resolvePrepare = async (): Promise<FundPrepareResponse> => {
    const activeSession = apsSessionRef.current;
    if (activeSession) {
      return activeSession.prepare;
    }

    const cached = prepareRef.current;
    if (cached && amountsMatch(cached.funding.amountGmd, numAmount)) {
      return cached;
    }

    const prepare = await prepareFund(numAmount);
    prepareRef.current = prepare;
    setPendingPrepare(prepare);
    clearApsSession();
    return prepare;
  };

  const runApsCheckout = async (
    prepare: FundPrepareResponse,
    wallet: CheckoutWallet,
    otpOverride?: string,
  ) => {
    const mobile = apsMobile.trim() || user?.phone?.trim() || '';
    if (!mobile) {
      setIsLoading(false);
      setError('Enter the mobile number linked to your APS wallet.');
      return;
    }

    let session = apsSessionRef.current;
    if (!session || session.fundingId !== prepare.funding.id) {
      const auth = await authorizeFundAps(prepare.funding.id, {
        gatewayCode: wallet.code,
        payerMobile: mobile,
      });
      session = {
        fundingId: prepare.funding.id,
        prepare,
        authState: auth.authState,
        gatewayCode: wallet.code,
      };
      apsSessionRef.current = session;
      setApsAuthState(auth.authState);
      setApsGatewayCode(wallet.code);
      if (auth.requiresOtp) {
        setApsStep('otp');
        setIsLoading(false);
        return;
      }
    }

    const otp = (otpOverride ?? apsOtp).trim();
    await completeFundAps(session.fundingId, {
      gatewayCode: session.gatewayCode,
      authState: session.authState,
      otp: otp || undefined,
    });
    clearApsSession();
    await pollUntilPaid(prepare.funding.id, prepare.funding.amountGmd, prepare.funding.usdEstimate);
  };

  const runSimulatedCheckout = async (prepare: FundPrepareResponse) => {
    const wallet = pickWalletForSource(prepare.wallets, source);
    const result = await simulateFund(prepare.funding.id, wallet?.code);
    await refreshBalances();
    setIsLoading(false);
    resetCheckout();
    setSuccessGmd(result.funding.amountGmd);
    setSuccessUsd(result.funding.usdEstimate);
    setIsSuccess(true);
  };

  const handleFund = async (otpOverride?: string) => {
    if (numAmount <= 0 || isLoading || fundInFlightRef.current) return;

    const canSimulate = simulationEnabled && user?.kycComplete && Boolean(user.phone?.trim());
    const canDirectPay =
      user?.directPayProvisioningStatus === 'active' && Boolean(user.directPayBusinessId);

    if (!canSimulate && !canDirectPay) {
      setError(
        user?.kycComplete
          ? simulationEnabled
            ? 'Add your phone number in profile to create your vPay wallet.'
            : 'Your directPay merchant is still being set up. Try again shortly.'
          : 'Complete identity verification before adding funds.',
      );
      return;
    }

    clearError();
    setIsLoading(true);
    fundInFlightRef.current = true;
    try {
      const prepare = await resolvePrepare();

      if (simulationEnabled || prepare.simulationEnabled) {
        await runSimulatedCheckout(prepare);
        return;
      }

      if (prepare.wallets.length === 0) {
        setError(
          prepare.prepareHint ??
            'No payment wallets are available yet. Try again later or contact support.',
        );
        setIsLoading(false);
        return;
      }

      const wallet = pickWalletForSource(prepare.wallets, source);
      if (!wallet) {
        setError(`No ${source.toUpperCase()} checkout is configured. Try another payment source.`);
        setIsLoading(false);
        return;
      }

      const isAps = wallet.code.toLowerCase().includes('aps') || source === 'aps';
      if (isAps) {
        await runApsCheckout(prepare, wallet, otpOverride);
      } else {
        await runWalletCheckout(prepare, wallet);
      }
    } catch (e) {
      setIsLoading(false);
      const raw = e instanceof ApiError ? e.message : 'Could not start payment';
      setError(toFriendlyFundError(raw));
    } finally {
      fundInFlightRef.current = false;
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
        <Text style={styles.successTitle}>Wallet top-up successful</Text>
        <Text style={styles.successBody}>
          <Text style={styles.successAmount}>{formatGmd(successGmd)}</Text> added to your vPay
          wallet (≈ ${successUsd.toFixed(2)} USD estimate).
        </Text>
        <Pressable
          style={styles.doneButton}
          onPress={() => {
            setIsSuccess(false);
            setFlowStep('main');
            setAmount('');
            setApsMobile('');
            resetCheckout();
            setError('');
          }}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PullToRefreshScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={walletRefreshing}
        onRefresh={onRefresh}>
        {flowStep !== 'main' ? (
          <Pressable
            style={styles.backButton}
            onPress={flowStep === 'checkout' ? goBackToAmount : goBackToMain}
            disabled={isLoading}
            hitSlop={8}>
            <ChevronLeft size={22} color={colors.gray600} />
            <Text style={styles.backButtonText}>
              {flowStep === 'checkout' ? 'Change amount' : 'Back'}
            </Text>
          </Pressable>
        ) : null}

        <View>
          <Text style={styles.title}>Wallet</Text>
          <Text style={styles.subtitle}>
            {flowStep === 'main'
              ? 'Your vPay wallet balance'
              : flowStep === 'amount'
                ? 'Add money via APS or Wave'
                : 'Choose a payment source and confirm'}
          </Text>
        </View>

      {user?.kycComplete && user.directPayProvisioningStatus !== 'active' && !simulationEnabled ? (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>
            Setting up your directPay merchant… funding will be available once complete.
          </Text>
        </View>
      ) : null}

      {/* {simulationEnabled ? (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerTitle}>Development mode</Text>
          <Text style={styles.devBannerText}>
            Wallet top-ups are simulated in development — fund your card from the Cards tab.
          </Text>
        </View>
      ) : null} */}

        {flowStep === 'main' ? (
          <Animated.View entering={FadeInUp.duration(350)} style={styles.stepBlock}>
            <View style={styles.walletCard}>
              <Text style={styles.walletLabel}>vPay wallet</Text>
              {walletLoading && !wallet ? (
                <ActivityIndicator color={colors.emerald600} style={{ marginVertical: 8 }} />
              ) : wallet ? (
                <>
                  <Text style={styles.walletBalance}>{formatGmd(wallet.balanceGmd)}</Text>
                  {/* <Text style={styles.walletPhone}>{wallet.phoneNumber}</Text> */}
                </>
              ) : (
                <Text style={styles.walletMissing}>
                  Add your phone number in profile to create your wallet.
                </Text>
              )}
              <Pressable
                style={[styles.secondaryButton, !wallet && styles.primaryButtonDisabled]}
                onPress={() => {
                  clearError();
                  setFlowStep('amount');
                }}
                disabled={!wallet}>
                <Text style={styles.secondaryButtonText}>Add money</Text>
              </Pressable>
            </View>

            {error ? (
              <Animated.View entering={FadeInDown.duration(250)} style={styles.errorBanner}>
                <XCircle size={18} color={colors.red500} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : flowStep === 'amount' ? (
          <Animated.View entering={FadeInUp.duration(350)} style={styles.stepBlock}>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount (GMD)</Text>
              <View style={styles.amountInputRow}>
                <Text style={[styles.currencySymbol, numAmount > 0 && styles.currencySymbolActive]}>
                  D
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v.replace(/[^0-9.]/g, ''));
                    resetCheckout();
                    clearError();
                  }}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, !amount && styles.amountInputPlaceholder]}
                  placeholder="1000"
                  placeholderTextColor={colors.gray300}
                  editable={!isLoading}
                  autoFocus
                />
              </View>
              {numAmount > 0 && usdEquivalent !== undefined ? (
                <View style={styles.usdBadge}>
                  <Text style={styles.usdText}>≈ ${usdEquivalent.toFixed(2)} USD</Text>
                </View>
              ) : numAmount > 0 ? (
                <Text style={styles.amountHint}>Loading estimate…</Text>
              ) : (
                <Text style={styles.amountHint}>You will see the USD estimate after entering an amount</Text>
              )}
            </View>

            <Pressable
              style={[styles.primaryButton, numAmount <= 0 && styles.primaryButtonDisabled]}
              onPress={confirmAmount}
              disabled={numAmount <= 0}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <ArrowRight size={20} color={colors.white} />
            </Pressable>

            {error ? (
              <Animated.View entering={FadeInDown.duration(250)} style={styles.errorBanner}>
                <XCircle size={18} color={colors.red500} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.stepBlock}>
            <View style={styles.amountSummaryChip}>
              <View>
                <Text style={styles.amountSummaryLabel}>Funding amount</Text>
                <Text style={styles.amountSummaryValue}>D {numAmount.toFixed(2)}</Text>
              </View>
              {usdEquivalent !== undefined ? (
                <View style={styles.amountSummaryUsd}>
                  <Text style={styles.amountSummaryUsdText}>≈ ${usdEquivalent.toFixed(2)} USD</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.sourceSection}>
              <Text style={styles.sourceTitle}>Pay from</Text>
              <View style={styles.sourceGrid}>
                {fundingSources.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => selectSource(s.id)}
                    disabled={isLoading || apsStep === 'otp'}
                    style={[
                      styles.sourceCard,
                      source === s.id && styles.sourceCardActive,
                    ]}>
                    <View style={styles.sourceLogoWrap}>
                      <Image
                        source={s.logo}
                        style={[
                          styles.sourceLogo,
                          s.logoScale ? { transform: [{ scale: s.logoScale }] } : null,
                        ]}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={styles.sourceName}>{s.name}</Text>
                    {source === s.id ? (
                      <View style={styles.sourceCheck}>
                        <CheckCircle2 size={16} color={colors.emerald600} />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>

            {source === 'aps' && apsStep === 'idle' && !simulationEnabled ? (
              <View style={styles.apsSection}>
                <Text style={styles.apsLabel}>APS mobile number</Text>
                <View style={styles.apsInputRow}>
                  <Smartphone size={18} color={colors.gray400} />
                  <TextInput
                    value={apsMobile}
                    onChangeText={(text) => {
                      setApsMobile(text);
                      clearError();
                    }}
                    keyboardType="phone-pad"
                    placeholder="220XXXXXXX"
                    placeholderTextColor={colors.gray400}
                    style={styles.apsInputField}
                    editable={!isLoading}
                  />
                </View>
                <Text style={styles.apsHint}>We will send a one-time code to this number</Text>
              </View>
            ) : null}

            {source === 'aps' && apsStep === 'otp' && !simulationEnabled ? (
              <View style={styles.otpSection}>
                <View style={styles.otpHeader}>
                  <View style={styles.otpIconWrap}>
                    <Smartphone size={24} color={colors.emerald600} />
                  </View>
                  <Text style={styles.otpTitle}>Verify APS payment</Text>
                  <Text style={styles.otpSubtitle}>
                    Enter the code sent to{'\n'}
                    <Text style={styles.otpPhoneHighlight}>{apsMobile || user?.phone}</Text>
                  </Text>
                </View>
                <OtpInput
                  ref={otpRef}
                  value={apsOtp}
                  onChange={(code) => {
                    setApsOtp(code);
                    clearError();
                  }}
                  onComplete={(code) => handleFund(code)}
                  disabled={isLoading}
                  error={!!error}
                  autoFocus
                />
              </View>
            ) : null}

            <View style={styles.summary}>
              <SummaryRow label="Amount" value={`D ${numAmount.toFixed(2)}`} />
              <SummaryRow
                label={`Fee (${feeLabel})`}
                value={fee !== undefined ? `D ${fee.toFixed(2)}` : '—'}
              />
              <SummaryRow
                label="Exchange rate"
                value={exchangeRate ? `1 USD = ${exchangeRate} GMD` : '—'}
              />
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total to pay</Text>
                <Text style={styles.summaryTotalValue}>
                  {totalGMD !== undefined ? `D ${totalGMD.toFixed(2)}` : '—'}
                </Text>
              </View>
            </View>

            {error ? (
              <Animated.View entering={FadeInDown.duration(250)} style={styles.errorBanner}>
                <XCircle size={18} color={colors.red500} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {apsStep !== 'otp' || simulationEnabled ? (
              <Pressable
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={() => handleFund()}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {simulationEnabled ? 'Simulate top-up' : 'Add to wallet'}
                    </Text>
                    <ArrowRight size={20} color={colors.white} />
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.primaryButton,
                  (isLoading || apsOtp.length < 6) && styles.primaryButtonDisabled,
                ]}
                onPress={() => handleFund()}
                disabled={isLoading || apsOtp.length < 6}>
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Confirm payment</Text>
                    <ArrowRight size={20} color={colors.white} />
                  </>
                )}
              </Pressable>
            )}
          </Animated.View>
        )}
      </PullToRefreshScrollView>
    </KeyboardAvoidingView>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: 24,
  },
  stepBlock: {
    gap: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: -8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray600,
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
  noticeBanner: {
    backgroundColor: colors.amber100,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.amber600,
  },
  noticeText: {
    fontSize: 13,
    color: colors.amber600,
    fontFamily: 'Inter_400Regular',
  },
  devBanner: {
    backgroundColor: colors.blue50,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.blue100,
    gap: 4,
  },
  devBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.blue600,
    fontFamily: 'Inter_700Bold',
  },
  devBannerText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.gray100,
    gap: 8,
  },
  walletLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter_600SemiBold',
  },
  walletBalance: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  walletPhone: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  walletUsd: {
    fontSize: 14,
    color: colors.emerald600,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  walletMissing: {
    fontSize: 14,
    color: colors.gray500,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'Inter_400Regular',
  },
  secondaryButton: {
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
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
    color: colors.gray300,
    fontFamily: 'Inter_700Bold',
  },
  currencySymbolActive: {
    color: colors.gray900,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.gray900,
    minWidth: 120,
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
    marginTop: 4,
  },
  amountSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  amountSummaryLabel: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },
  amountSummaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  amountSummaryUsd: {
    backgroundColor: colors.emerald50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  amountSummaryUsdText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
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
    position: 'relative',
  },
  sourceCardActive: {
    borderColor: colors.emerald600,
    backgroundColor: 'rgba(236,253,245,0.5)',
  },
  sourceLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  sourceLogo: {
    width: '100%',
    height: '100%',
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  sourceCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  apsSection: {
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  apsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  apsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  apsInputField: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  apsHint: {
    fontSize: 12,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  otpSection: {
    gap: 20,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  otpHeader: {
    alignItems: 'center',
    gap: 8,
  },
  otpIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
  },
  otpSubtitle: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  otpPhoneHighlight: {
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.red500,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  summary: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
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
  primaryButton: {
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
  primaryButtonDisabled: {
    backgroundColor: colors.gray300,
    shadowOpacity: 0,
  },
  primaryButtonText: {
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
