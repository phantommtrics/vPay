import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VPayWordmark } from '@/components/VPayWordmark';
import { colors, spacing } from '@/constants/theme';

type Step = 'email' | 'otp';

type DesktopLoginProps = {
  step: Step;
  onChangeEmail: () => void;
  children: ReactNode;
};

export function DesktopLogin({ step, onChangeEmail, children }: DesktopLoginProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.brand}>
        <LinearGradient
          colors={[colors.emerald950, colors.emerald800, colors.teal900]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.brandInner}>
          <VPayWordmark variant="dark" width={200} height={66} />
          <Text style={styles.headline}>Sign in to your vPay account</Text>
          <Text style={styles.brandBody}>
            Use the email on your account. We send a 6-digit code. There is no password.
          </Text>
        </View>
      </View>

      <View style={styles.formSection}>
        <View style={styles.formInner}>
          {step === 'otp' ? (
            <Pressable style={styles.backButton} onPress={onChangeEmail} hitSlop={8}>
              <ArrowLeft size={18} color={colors.gray600} />
              <Text style={styles.backText}>Change email</Text>
            </Pressable>
          ) : null}
          <Text style={styles.kicker}>{step === 'email' ? 'Email' : 'Verification code'}</Text>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.white,
    overflow: 'hidden',
    height: '100dvh' as unknown as number,
    maxHeight: '100dvh' as unknown as number,
  },
  brand: {
    flex: 1,
    backgroundColor: colors.emerald950,
    justifyContent: 'center',
    paddingHorizontal: 64,
  },
  brandInner: {
    maxWidth: 420,
    gap: 16,
  },
  headline: {
    marginTop: 28,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  brandBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.emerald100,
    fontFamily: 'Inter_400Regular',
    maxWidth: 360,
  },
  formSection: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    paddingHorizontal: 72,
  },
  formInner: {
    width: '100%',
    maxWidth: 420,
    gap: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 14,
    color: colors.gray600,
    fontFamily: 'Inter_500Medium',
  },
});
