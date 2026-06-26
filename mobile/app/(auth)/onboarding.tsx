import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Mail,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtpInput, type OtpInputRef } from '@/components/OtpInput';
import { VPayWordmark } from '@/components/VPayWordmark';
import { useAuth } from '@/contexts/AuthContext';
import { sendOtp } from '@/lib/api';
import { colors, radius, spacing } from '@/constants/theme';

type Step = 'email' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const otpRef = useRef<OtpInputRef>(null);
  const verifyingRef = useRef(false);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(trimmedEmail);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOtp = useCallback(async () => {
    if (!emailValid) {
      setError('Enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await sendOtp(trimmedEmail);
      setEmail(trimmedEmail);
      setStep('otp');
      setOtp('');
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }, [trimmedEmail, emailValid]);

  const handleVerify = useCallback(
    async (code?: string) => {
      const value = code ?? otp;
      if (value.length !== 6) {
        setError('Enter the 6-digit code');
        return;
      }
      if (verifyingRef.current) return;

      verifyingRef.current = true;
      setError('');
      setLoading(true);

      try {
        await signIn(email, value);
        router.replace('/(tabs)');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
        setOtp('');
        otpRef.current?.focus();
      } finally {
        setLoading(false);
        verifyingRef.current = false;
      }
    },
    [email, otp, signIn],
  );

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    setError('');
    setLoading(true);

    try {
      await sendOtp(email);
      setResendCooldown(60);
      setOtp('');
      otpRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldown]);

  const goBackToEmail = () => {
    setStep('email');
    setOtp('');
    setError('');
    setTimeout(() => emailRef.current?.focus(), 300);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.emerald950, colors.emerald800, colors.teal900]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.orbLarge} />
        <View style={styles.orbSmall} />

        {step === 'otp' ? (
          <Pressable style={styles.backButton} onPress={goBackToEmail}>
            <ArrowLeft size={20} color={colors.emerald200} />
            <Text style={styles.backText}>Change email</Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <Animated.View entering={FadeInDown.duration(500)} style={styles.heroContent}>
          <View style={styles.wordmarkWrap}>
            <VPayWordmark variant="dark" width={200} height={66} />
          </View>

          <StepIndicator step={step} />
        </Animated.View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}>
          {step === 'email' ? (
            <Animated.View
              key="email-step"
              entering={FadeInUp.duration(400)}
              exiting={FadeOut.duration(200)}
              style={styles.stepContent}>
              <Text style={styles.title}>Get started</Text>
              <Text style={styles.subtitle}>
                Enter your email and we&apos;ll send a secure 6-digit code. No password needed.
              </Text>

              <View style={styles.features}>
                <FeatureChip icon={Shield} label="Bank-grade security" />
                <FeatureChip icon={CreditCard} label="Instant virtual cards" />
                <FeatureChip icon={Sparkles} label="No password" />
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>Email address</Text>
                <View
                  style={[
                    styles.inputWrap,
                    emailFocused && styles.inputFocused,
                    error && !emailValid ? styles.inputError : null,
                    emailValid ? styles.inputValid : null,
                  ]}>
                  <Mail
                    size={20}
                    color={emailFocused ? colors.emerald600 : colors.gray400}
                  />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError('');
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.gray400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    onSubmitEditing={handleSendOtp}
                    autoFocus
                  />
                  {emailValid ? (
                    <CheckCircle2 size={20} color={colors.emerald600} />
                  ) : null}
                </View>
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              key="otp-step"
              entering={FadeInUp.duration(400)}
              exiting={FadeOut.duration(200)}
              style={styles.stepContent}>
              <View style={styles.otpHeader}>
                <View style={styles.mailIconWrap}>
                  <Mail size={28} color={colors.emerald600} />
                </View>
                <Text style={styles.title}>Check your inbox</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
              </View>

              <View style={styles.form}>
                <OtpInput
                  ref={otpRef}
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    setError('');
                  }}
                  onComplete={handleVerify}
                  disabled={loading}
                  error={!!error}
                  autoFocus
                />

                <Pressable
                  style={styles.resendRow}
                  onPress={handleResend}
                  disabled={resendCooldown > 0 || loading}>
                  <Text
                    style={[
                      styles.resendText,
                      resendCooldown > 0 && styles.resendMuted,
                    ]}>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't get it? Resend code"}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {error ? (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              (loading || (step === 'email' && !emailValid)) && styles.buttonDisabled,
            ]}
            onPress={step === 'email' ? handleSendOtp : () => handleVerify()}
            disabled={loading || (step === 'email' && !emailValid)}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {step === 'email' ? 'Continue' : 'Verify & Sign In'}
                </Text>
                <ArrowRight size={20} color={colors.white} />
              </View>
            )}
          </Pressable>

          <Text style={styles.legal}>
            By continuing, you agree to vPay&apos;s{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/terms')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = ['Email', 'Verify'];
  const activeIndex = step === 'email' ? 0 : 1;

  return (
    <View style={styles.steps}>
      {steps.map((label, index) => {
        const isActive = index === activeIndex;
        const isDone = index < activeIndex;

        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isDone && styles.stepDotDone,
              ]}>
              {isDone ? (
                <CheckCircle2 size={14} color={colors.emerald950} />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    isActive && styles.stepNumberActive,
                  ]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
              {label}
            </Text>
            {index < steps.length - 1 ? <View style={styles.stepLine} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function FeatureChip({
  icon: Icon,
  label,
}: {
  icon: typeof Shield;
  label: string;
}) {
  return (
    <View style={styles.chip}>
      <Icon size={14} color={colors.emerald700} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    overflow: 'hidden',
  },
  orbLarge: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  orbSmall: {
    position: 'absolute',
    bottom: 20,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  backSpacer: {
    height: 28,
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: 14,
    color: colors.emerald200,
    fontFamily: 'Inter_500Medium',
  },
  heroContent: {
    gap: 24,
  },
  wordmarkWrap: {
    alignSelf: 'flex-start',
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.emerald200,
  },
  stepDotDone: {
    backgroundColor: colors.emerald200,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_600SemiBold',
  },
  stepNumberActive: {
    color: colors.emerald950,
  },
  stepLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_500Medium',
  },
  stepLabelActive: {
    color: colors.white,
    fontWeight: '600',
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
  sheetWrap: {
    flex: 1,
    marginTop: -24,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    gap: 20,
    shadowColor: colors.gray900,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  stepContent: {
    gap: 20,
  },
  otpHeader: {
    alignItems: 'center',
    gap: 12,
  },
  mailIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.emerald100,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  emailHighlight: {
    color: colors.emerald700,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.emerald50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.emerald100,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.emerald800,
    fontFamily: 'Inter_500Medium',
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.gray50,
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputFocused: {
    borderColor: colors.emerald600,
    backgroundColor: colors.emerald50,
  },
  inputValid: {
    borderColor: colors.emerald600,
  },
  inputError: {
    borderColor: colors.red500,
    backgroundColor: colors.red50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
  },
  resendRow: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.emerald600,
    fontFamily: 'Inter_500Medium',
  },
  resendMuted: {
    color: colors.gray400,
  },
  errorBanner: {
    backgroundColor: colors.red50,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: colors.red500,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  primaryButton: {
    backgroundColor: colors.emerald600,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.emerald600,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.gray400,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  legalLink: {
    color: colors.emerald600,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
