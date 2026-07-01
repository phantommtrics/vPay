import { useState } from 'react';
import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Fingerprint,
  ScanFace,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import {
  ActivityIndicator,
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
import { colors, radius, spacing } from '@/constants/theme';

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { biometricsAvailable, biometricMethod, appLockEnabled, setAppLockEnabled, lock } =
    useAppLock();
  const [deviceLockBusy, setDeviceLockBusy] = useState(false);
  const [deviceLockError, setDeviceLockError] = useState('');

  const biometricLabel = getBiometricLabel(biometricMethod);
  const LockIcon = biometricMethod === 'faceId' ? ScanFace : Fingerprint;

  const lockDescription =
    Platform.OS === 'ios'
      ? biometricsAvailable
        ? `Require ${biometricLabel} to open vPay. If unavailable, sign in with your email.`
        : 'Sign in with your email when the app is locked.'
      : biometricsAvailable
        ? 'Require biometrics to open vPay. If unavailable, sign in with your email.'
        : 'Sign in with your email when the app is locked.';

  const deviceLockOn = Boolean(user?.deviceLockEnabled && user?.deviceLockActiveOnThisDevice);

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
              <Text style={styles.sectionSubtitle}>{lockDescription}</Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>App lock</Text>
            <Switch
              value={appLockEnabled}
              onValueChange={setAppLockEnabled}
              trackColor={{ false: colors.gray200, true: colors.emerald200 }}
              thumbColor={appLockEnabled ? colors.emerald600 : colors.gray400}
            />
          </View>

          {biometricsAvailable ? (
            <Text style={styles.methodNote}>
              {Platform.OS === 'ios'
                ? `${biometricLabel} is enabled on this device.`
                : 'Biometric unlock is enabled on this device.'}
            </Text>
          ) : (
            <Text style={styles.unavailableNote}>
              {Platform.OS === 'ios'
                ? 'Face ID or Touch ID is not set up. The app will use email sign-in to unlock.'
                : 'Biometrics are not set up. The app will use email sign-in to unlock.'}
            </Text>
          )}
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
                <Text style={styles.sectionTitle}>Device security</Text>
                <Text style={styles.sectionSubtitle}>
                  Limit sign-in to this device only, or use up to{' '}
                  {user.monthlyDevicesLimit ?? 3} devices per calendar month.
                </Text>
              </View>
            </View>

            <View style={styles.deviceToggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>Lock account to this device</Text>
                <Text style={styles.toggleHint}>
                  {deviceLockOn
                    ? 'Your account can only be opened on this phone or tablet.'
                    : 'When enabled, you cannot sign in from another device until you turn this off here.'}
                </Text>
              </View>
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

            <Text style={styles.usageNote}>
              {user.monthlyDevicesUsed ?? 0} of {user.monthlyDevicesLimit ?? 3} devices used this
              month on your account.
            </Text>

            {user.deviceLockEnabled && !user.deviceLockActiveOnThisDevice ? (
              <View style={styles.deviceLockWarning}>
                <AlertCircle size={16} color={colors.amber600} />
                <Text style={styles.deviceLockWarningText}>
                  Device lock is active on another device. Sign in there to manage this setting.
                </Text>
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
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.gray500,
    lineHeight: 18,
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
  deviceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray50,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
  toggleHint: {
    fontSize: 12,
    color: colors.gray500,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
  },
  methodNote: {
    fontSize: 13,
    color: colors.emerald700,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  unavailableNote: {
    fontSize: 13,
    color: colors.gray500,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  usageNote: {
    fontSize: 12,
    color: colors.emerald700,
    fontFamily: 'Inter_400Regular',
  },
  deviceLockWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.amber100,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  deviceLockWarningText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray700,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
  },
  deviceLockError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  deviceLockErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.red500,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
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
});
