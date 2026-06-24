import { router } from 'expo-router';
import { ArrowLeft, Fingerprint, ScanFace, ShieldCheck } from 'lucide-react-native';
import { Pressable, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLock } from '@/contexts/AppLockContext';
import { getBiometricLabel } from '@/lib/biometrics';
import { colors, radius, spacing } from '@/constants/theme';

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { biometricsAvailable, biometricMethod, appLockEnabled, setAppLockEnabled, lock } =
    useAppLock();

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.gray900} />
        </Pressable>
        <Text style={styles.screenTitle}>Security</Text>
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
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
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
