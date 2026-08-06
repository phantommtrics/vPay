import { ArrowUpCircle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import { fetchAppConfig } from '@/lib/api';
import { evaluateAppUpdate, type AppUpdateDecision } from '@/lib/app-update';

/**
 * Renders children normally and overlays an update bottom sheet on any screen
 * (login, tabs, etc.) when the backend requires a newer build.
 */
export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [decision, setDecision] = useState<AppUpdateDecision | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const config = await fetchAppConfig();
      const next = evaluateAppUpdate(config);
      setDecision(next);
      if (!next.updateRequired) {
        setDismissed(false);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('App update check failed', error);
      }
      // Fail open — don't block the app when config is unreachable.
      setDecision(null);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const onChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        check();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [check]);

  const visible =
    Boolean(decision?.updateRequired) && !(dismissed && decision && !decision.force);

  const openStore = () => {
    if (decision?.storeUrl) {
      Linking.openURL(decision.storeUrl).catch(() => {});
    }
  };

  const onRequestClose = () => {
    if (decision?.force) return;
    setDismissed(true);
  };

  return (
    <>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onRequestClose}>
        <View style={styles.backdrop}>
          <Pressable
            style={styles.backdropHit}
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel={decision?.force ? undefined : 'Dismiss update prompt'}
            disabled={Boolean(decision?.force)}
          />

          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
            ]}
            accessibilityViewIsModal>
            <View style={styles.handle} />

            <View style={styles.iconRing}>
              <ArrowUpCircle size={44} color={colors.emerald600} strokeWidth={1.75} />
            </View>

            <Text style={styles.title}>
              {decision?.force ? 'Update required' : 'Update available'}
            </Text>
            <Text style={styles.message}>
              {decision?.message ?? 'Please update vPay to continue.'}
            </Text>

            {decision?.storeUrl ? (
              <Pressable
                onPress={openStore}
                accessibilityRole="button"
                accessibilityLabel="Update app"
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}>
                <Text style={styles.primaryButtonText}>Update now</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                Install the latest version from the App Store or Play Store, then reopen vPay.
              </Text>
            )}

            <Pressable
              onPress={check}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Check again for updates">
              <Text style={styles.secondaryLink}>I've updated — check again</Text>
            </Pressable>

            {!decision?.force ? (
              <Pressable
                onPress={() => setDismissed(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Not now">
                <Text style={styles.dismissLink}>Not now</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
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
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 300,
  },
  secondaryLink: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: colors.emerald700,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  dismissLink: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.gray500,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
