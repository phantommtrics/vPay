import { router } from 'expo-router';
import { Fingerprint, Lock, ScanFace } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtpInput } from '@/components/OtpInput';
import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';
import { PIN_LENGTH } from '@/lib/app-lock-credential';
import { getBiometricLabel, getLockHint } from '@/lib/biometrics';
import type { BiometricMethod } from '@/lib/biometrics';
import { colors, radius, spacing } from '@/constants/theme';

function BiometricGlyph({ method, dimmed }: { method: BiometricMethod; dimmed?: boolean }) {
  const color = dimmed ? colors.gray300 : colors.emerald600;
  const size = 56;

  if (method === 'faceId') {
    return <ScanFace size={size} color={color} strokeWidth={1.5} />;
  }

  if (method === 'touchId' || method === 'androidBiometric') {
    return <Fingerprint size={size} color={color} strokeWidth={1.5} />;
  }

  return <Lock size={size} color={color} strokeWidth={1.5} />;
}

export function AppLockScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const {
    isChecking,
    biometricsAvailable,
    biometricMethod,
    credentialType,
    hasCredential,
    unlock,
    unlockWithCredential,
  } = useAppLock();

  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);

  const showCredentialUnlock = !biometricsAvailable && hasCredential;
  const biometricLabel = getBiometricLabel(biometricMethod);
  const hint = getLockHint(biometricMethod, showCredentialUnlock ? credentialType : null);

  const handleSignInAgain = async () => {
    await signOut();
    router.replace('/onboarding');
  };

  const submitCredential = useCallback(
    async (value: string) => {
      if (!value || isChecking) return;

      setError('');
      try {
        const ok = await unlockWithCredential(value);
        if (!ok) {
          setError(credentialType === 'pin' ? 'Incorrect PIN' : 'Incorrect password');
          setSecret('');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not unlock');
        setSecret('');
      }
    },
    [credentialType, isChecking, unlockWithCredential],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.inner}>
          <Text style={styles.brand}>vPay</Text>

          <View style={styles.center}>
            {biometricsAvailable ? (
              <Pressable
                onPress={() => !isChecking && unlock()}
                disabled={isChecking}
                accessibilityRole="button"
                accessibilityLabel={`Unlock with ${biometricLabel}`}
                style={({ pressed }) => [
                  styles.glyphRing,
                  pressed && !isChecking && styles.glyphRingPressed,
                ]}>
                {isChecking ? (
                  <ActivityIndicator size="large" color={colors.emerald600} />
                ) : (
                  <BiometricGlyph method={biometricMethod} />
                )}
              </Pressable>
            ) : (
              <View style={[styles.glyphRing, styles.glyphRingMuted]}>
                <BiometricGlyph method="none" dimmed />
              </View>
            )}

            <Text style={styles.title}>Locked</Text>
            <Text style={styles.hint}>{hint}</Text>

            {biometricsAvailable && !isChecking ? (
              <Text style={styles.retryHint}>Tap the icon to try again</Text>
            ) : null}

            {showCredentialUnlock ? (
              <View style={styles.credentialForm}>
                {credentialType === 'pin' ? (
                  <OtpInput
                    length={PIN_LENGTH}
                    value={secret}
                    onChange={(value) => {
                      setSecret(value);
                      setError('');
                    }}
                    onComplete={(value) => void submitCredential(value)}
                    disabled={isChecking}
                    error={!!error}
                    autoFocus
                  />
                ) : (
                  <View
                    style={[
                      styles.passwordWrap,
                      passwordFocused && styles.passwordWrapFocused,
                      error ? styles.passwordWrapError : null,
                    ]}>
                    <TextInput
                      style={styles.passwordInput}
                      value={secret}
                      onChangeText={(value) => {
                        setSecret(value);
                        setError('');
                      }}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      placeholder="Password"
                      placeholderTextColor={colors.gray400}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      autoComplete="password"
                      returnKeyType="go"
                      editable={!isChecking}
                      onSubmitEditing={() => void submitCredential(secret)}
                      autoFocus
                    />
                  </View>
                )}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {credentialType === 'password' ? (
                  <Pressable
                    style={[
                      styles.unlockButton,
                      (!secret || isChecking) && styles.unlockButtonDisabled,
                    ]}
                    onPress={() => void submitCredential(secret)}
                    disabled={!secret || isChecking}>
                    {isChecking ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.unlockButtonText}>Unlock</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={handleSignInAgain}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Sign in with email">
            <Text style={styles.emailLink}>Sign in with email</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    zIndex: 100,
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.emerald700,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  glyphRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: colors.emerald100,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  glyphRingPressed: {
    backgroundColor: colors.emerald100,
    borderColor: colors.emerald200,
  },
  glyphRingMuted: {
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  hint: {
    fontSize: 15,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 22,
  },
  retryHint: {
    fontSize: 13,
    color: colors.gray400,
    fontFamily: 'Inter_400Regular',
    marginTop: spacing.xs,
  },
  credentialForm: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  passwordWrap: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  passwordWrapFocused: {
    borderColor: colors.emerald600,
    backgroundColor: colors.emerald50,
  },
  passwordWrapError: {
    borderColor: colors.red500,
    backgroundColor: colors.red50,
  },
  passwordInput: {
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  errorText: {
    fontSize: 13,
    color: colors.red500,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  unlockButton: {
    backgroundColor: colors.emerald600,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonDisabled: {
    opacity: 0.5,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  emailLink: {
    fontSize: 14,
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    paddingBottom: spacing.lg,
    textDecorationLine: 'underline',
  },
});
