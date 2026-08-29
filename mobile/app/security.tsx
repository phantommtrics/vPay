import { useState } from 'react';
import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Fingerprint,
  KeyRound,
  ScanFace,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';
import { updateDeviceLock } from '@/lib/api';
import { getBiometricLabel } from '@/lib/biometrics';
import { collectDeviceInfo } from '@/lib/device-info';
import { hasCredentialReauth, nextAfterVerify } from '@/lib/credential-setup';
import { colors, radius, spacing } from '@/constants/theme';

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const {
    biometricsAvailable,
    biometricMethod,
    appLockEnabled,
    setAppLockEnabled,
    lock,
    credentialType,
    hasCredential,
    clearCredential,
  } = useAppLock();
  const [deviceLockBusy, setDeviceLockBusy] = useState(false);
  const [deviceLockError, setDeviceLockError] = useState('');
  const [credentialBusy, setCredentialBusy] = useState(false);

  const biometricLabel = getBiometricLabel(biometricMethod);
  const LockIcon = biometricMethod === 'faceId' ? ScanFace : Fingerprint;
  const deviceLockOn = Boolean(user?.deviceLockEnabled && user?.deviceLockActiveOnThisDevice);

  const handleRemoveCredential = () => {
    Alert.alert(
      'Remove PIN or password?',
      biometricsAvailable
        ? 'You can still unlock with biometrics or email.'
        : 'Unlocking will require email sign-in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCredentialBusy(true);
              try {
                await clearCredential();
              } catch {
                Alert.alert('Could not remove');
              } finally {
                setCredentialBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDeviceLockToggle = async (enabled: boolean) => {
    setDeviceLockError('');
    setDeviceLockBusy(true);
    try {
      const deviceInfo = enabled ? await collectDeviceInfo() : undefined;
      await updateDeviceLock(enabled, deviceInfo);
      await refreshUser();
    } catch (err) {
      setDeviceLockError(err instanceof Error ? err.message : 'Could not update device lock');
    } finally {
      setDeviceLockBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.gray900} />
        </Pressable>
        <Text style={styles.screenTitle}>Security & Limits</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.emerald50 }]}>
              <ShieldCheck size={18} color={colors.emerald600} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>App lock</Text>
              {biometricsAvailable ? (
                <Text style={styles.sectionMeta}>{biometricLabel}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Require lock</Text>
            <Switch
              value={appLockEnabled}
              onValueChange={setAppLockEnabled}
              trackColor={{ false: colors.gray200, true: colors.emerald200 }}
              thumbColor={appLockEnabled ? colors.emerald600 : colors.gray400}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.emerald50 }]}>
              <KeyRound size={18} color={colors.emerald600} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>PIN & password</Text>
              <Text style={styles.sectionMeta}>
                {hasCredential
                  ? credentialType === 'pin'
                    ? 'PIN is set'
                    : 'Password is set'
                  : 'Not set'}
              </Text>
            </View>
          </View>

          {hasCredential ? (
            <View style={styles.credentialActions}>
              <Pressable
                style={styles.choiceButton}
                onPress={() => {
                  const dest = nextAfterVerify('change', credentialType);
                  if (hasCredentialReauth()) {
                    router.push(
                      dest.params
                        ? { pathname: dest.pathname, params: dest.params }
                        : dest.pathname,
                    );
                    return;
                  }
                  router.push({ pathname: '/verify-credential', params: { next: 'change' } });
                }}
                disabled={credentialBusy}>
                <Text style={styles.choiceButtonText}>
                  {credentialType === 'pin' ? 'Change PIN' : 'Change password'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.choiceButton}
                onPress={() => {
                  const next = credentialType === 'pin' ? 'switch-password' : 'switch-pin';
                  const dest = nextAfterVerify(next, credentialType);
                  if (hasCredentialReauth()) {
                    router.push(
                      dest.params
                        ? { pathname: dest.pathname, params: dest.params }
                        : dest.pathname,
                    );
                    return;
                  }
                  router.push({ pathname: '/verify-credential', params: { next } });
                }}
                disabled={credentialBusy}>
                <Text style={styles.choiceButtonText}>
                  {credentialType === 'pin' ? 'Use password' : 'Use PIN'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.credentialActions}>
              <Pressable style={styles.choiceButton} onPress={() => router.push('/set-pin')}>
                <Text style={styles.choiceButtonText}>Set PIN</Text>
              </Pressable>
              <Pressable
                style={styles.choiceButton}
                onPress={() => router.push('/set-password')}>
                <Text style={styles.choiceButtonText}>Set password</Text>
              </Pressable>
            </View>
          )}

          {hasCredential ? (
            <Pressable
              style={styles.dangerButton}
              onPress={handleRemoveCredential}
              disabled={credentialBusy}>
              <Text style={styles.dangerButtonText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        {appLockEnabled ? (
          <Pressable style={styles.lockButton} onPress={lock}>
            <LockIcon size={20} color={colors.emerald700} />
            <Text style={styles.lockButtonText}>Lock now</Text>
          </Pressable>
        ) : null}

        {user ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.emerald50 }]}>
                <Smartphone size={18} color={colors.emerald600} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Device lock</Text>
                <Text style={styles.sectionMeta}>
                  {user.monthlyDevicesUsed ?? 0}/{user.monthlyDevicesLimit ?? 3} devices this month
                </Text>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>This device only</Text>
              {deviceLockBusy ? (
                <ActivityIndicator size="small" color={colors.emerald600} />
              ) : (
                <Switch
                  value={deviceLockOn}
                  onValueChange={(value) => void handleDeviceLockToggle(value)}
                  trackColor={{ false: colors.gray200, true: colors.emerald200 }}
                  thumbColor={deviceLockOn ? colors.emerald600 : colors.gray400}
                />
              )}
            </View>

            {user.deviceLockEnabled && !user.deviceLockActiveOnThisDevice ? (
              <View style={styles.deviceLockWarning}>
                <AlertCircle size={16} color={colors.amber600} />
                <Text style={styles.deviceLockWarningText}>Locked to another device</Text>
              </View>
            ) : null}

            {deviceLockError ? (
              <View style={styles.deviceLockError}>
                <AlertCircle size={16} color={colors.red500} />
                <Text style={styles.deviceLockErrorText}>{deviceLockError}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  headerSpacer: {
    width: 40,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionMeta: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray50,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  credentialActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.emerald100,
    backgroundColor: colors.emerald50,
    paddingHorizontal: spacing.sm,
  },
  choiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
  },
  dangerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red500,
    backgroundColor: colors.red50,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.red500,
    fontFamily: 'Inter_600SemiBold',
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald100,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  lockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.emerald700,
    fontFamily: 'Inter_600SemiBold',
  },
  deviceLockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.amber100,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  deviceLockWarningText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  deviceLockError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  deviceLockErrorText: {
    flex: 1,
    fontSize: 13,
    color: colors.red500,
    fontFamily: 'Inter_500Medium',
  },
});
