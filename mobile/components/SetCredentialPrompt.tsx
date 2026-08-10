import { router } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { getAppLockCredentialInfo } from '@/lib/app-lock-credential';
import {
  clearPendingCredentialPrompt,
  hasPendingCredentialPrompt,
} from '@/lib/app-lock-storage';
import { colors, radius, spacing } from '@/constants/theme';

/**
 * After email OTP sign-in, prompts the user to set an app PIN/password when none exists.
 */
export function SetCredentialPrompt() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !hasPendingCredentialPrompt()) {
      return;
    }

    let cancelled = false;

    async function maybeShow() {
      try {
        const info = await getAppLockCredentialInfo();
        if (cancelled) return;

        clearPendingCredentialPrompt();

        // Only prompt when no app PIN/password has been set yet.
        if (!info) {
          setVisible(true);
        }
      } catch {
        if (!cancelled) {
          clearPendingCredentialPrompt();
        }
      }
    }

    void maybeShow();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = () => {
    setVisible(false);
  };

  const openSecurity = () => {
    setVisible(false);
    router.push('/security');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropHit}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />

        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
          ]}
          accessibilityViewIsModal>
          <View style={styles.handle} />

          <View style={styles.iconRing}>
            <KeyRound size={40} color={colors.emerald600} strokeWidth={1.75} />
          </View>

          <Text style={styles.title}>Set a PIN or password</Text>
          <Text style={styles.message}>
            If biometrics aren&apos;t available, you can unlock with your PIN or password instead of
            waiting for an email code.
          </Text>

          <Pressable
            onPress={openSecurity}
            accessibilityRole="button"
            accessibilityLabel="Set PIN or password"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}>
            <Text style={styles.primaryButtonText}>Set now</Text>
          </Pressable>

          <Pressable
            onPress={dismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Not now">
            <Text style={styles.dismissLink}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdropHit: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    marginBottom: spacing.lg,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: colors.gray900,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  primaryButton: {
    backgroundColor: colors.emerald600,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonPressed: {
    backgroundColor: colors.emerald700,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  dismissLink: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.gray500,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
