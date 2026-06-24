import { router } from 'expo-router';
import { Fingerprint, Lock, ScanFace } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';
import { getBiometricLabel, getLockHint } from '@/lib/biometrics';
import type { BiometricMethod } from '@/lib/biometrics';
import { colors, spacing } from '@/constants/theme';

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
  const { isChecking, biometricsAvailable, biometricMethod, unlock } = useAppLock();

  const biometricLabel = getBiometricLabel(biometricMethod);
  const hint = getLockHint(biometricMethod);

  const handleSignInAgain = async () => {
    await signOut();
    router.replace('/onboarding');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
        </View>

        <Pressable
          onPress={handleSignInAgain}
          hitSlop={12}
          accessibilityRole="link"
          accessibilityLabel="Sign in with email">
          <Text style={styles.emailLink}>Sign in with email</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    zIndex: 100,
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
  emailLink: {
    fontSize: 14,
    color: colors.gray500,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    paddingBottom: spacing.lg,
    textDecorationLine: 'underline',
  },
});
