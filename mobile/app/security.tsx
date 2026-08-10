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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtpInput } from '@/components/OtpInput';
import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  PASSWORD_MIN_LENGTH,
  PIN_LENGTH,
  validateCredential,
  type AppLockCredentialType,
} from '@/lib/app-lock-credential';
import { updateDeviceLock } from '@/lib/api';
import { getBiometricLabel } from '@/lib/biometrics';
import { collectDeviceInfo } from '@/lib/device-info';
import { colors, radius, spacing } from '@/constants/theme';

type CredentialEditorMode = AppLockCredentialType | null;

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
    setCredential,
    clearCredential,
  } = useAppLock();
  const [deviceLockBusy, setDeviceLockBusy] = useState(false);
  const [deviceLockError, setDeviceLockError] = useState('');
  const [editorMode, setEditorMode] = useState<CredentialEditorMode>(null);
  const [secret, setSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialSuccess, setCredentialSuccess] = useState('');

  const biometricLabel = getBiometricLabel(biometricMethod);
  const LockIcon = biometricMethod === 'faceId' ? ScanFace : Fingerprint;

  const lockDescription =
    Platform.OS === 'ios'
      ? biometricsAvailable
        ? `Require ${biometricLabel} to open vPay. If unavailable, use your PIN/password or email.`
        : hasCredential
          ? 'Require your PIN or password to open vPay. Email sign-in remains available as a backup.'
          : 'Set a PIN or password below to unlock without waiting for an email code.'
      : biometricsAvailable
        ? 'Require biometrics to open vPay. If unavailable, use your PIN/password or email.'
        : hasCredential
          ? 'Require your PIN or password to open vPay. Email sign-in remains available as a backup.'
          : 'Set a PIN or password below to unlock without waiting for an email code.';

  const deviceLockOn = Boolean(user?.deviceLockEnabled && user?.deviceLockActiveOnThisDevice);

  const resetEditor = () => {
    setEditorMode(null);
    setSecret('');
    setConfirmSecret('');
    setCredentialError('');
  };

  const openEditor = (type: AppLockCredentialType) => {
    setCredentialSuccess('');
    setEditorMode(type);
    setSecret('');
    setConfirmSecret('');
    setCredentialError('');
  };

  const handleSaveCredential = async () => {
    if (!editorMode) return;

    const validationError = validateCredential(editorMode, secret);
    if (validationError) {
      setCredentialError(validationError);
      return;
    }

    if (secret !== confirmSecret) {
      setCredentialError(
        editorMode === 'pin' ? 'PINs do not match' : 'Passwords do not match',
      );
      return;
    }

    setCredentialBusy(true);
    setCredentialError('');
    try {
      await setCredential(editorMode, secret);
      setCredentialSuccess(editorMode === 'pin' ? 'PIN saved' : 'Password saved');
      resetEditor();
    } catch (err) {
      setCredentialError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setCredentialBusy(false);
    }
  };

  const handleRemoveCredential = () => {
    Alert.alert(
      'Remove unlock credential?',
      biometricsAvailable
        ? 'You can still unlock with biometrics or email sign-in.'
        : 'Without a PIN or password, unlocking will require email sign-in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCredentialBusy(true);
              setCredentialError('');
              try {
                await clearCredential();
                setCredentialSuccess('PIN/password removed');
                resetEditor();
              } catch (err) {
                setCredentialError(err instanceof Error ? err.message : 'Could not remove');
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
        keyboardShouldPersistTaps="handled"
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
                ? 'Face ID or Touch ID is not set up. Use a PIN/password or email to unlock.'
                : 'Biometrics are not set up. Use a PIN/password or email to unlock.'}
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.emerald50 }]}>
              <KeyRound size={18} color={colors.emerald600} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Password / PIN</Text>
              <Text style={styles.sectionSubtitle}>
                Used to unlock when biometrics are unavailable. PIN is 4 digits; password needs at
                least {PASSWORD_MIN_LENGTH} characters.
              </Text>
            </View>
          </View>

          {!editorMode && hasCredential ? (
            <View style={styles.credentialStatus}>
              <Text style={styles.methodNote}>
                {credentialType === 'pin' ? 'PIN is set' : 'Password is set'}
              </Text>
              <View style={styles.credentialActions}>
                <Pressable
                  style={styles.choiceButton}
                  onPress={() => openEditor(credentialType ?? 'pin')}
                  disabled={credentialBusy}>
                  <Text style={styles.choiceButtonText}>
                    {credentialType === 'pin' ? 'Change PIN' : 'Change password'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.choiceButton}
                  onPress={() =>
                    openEditor(credentialType === 'pin' ? 'password' : 'pin')
                  }
                  disabled={credentialBusy}>
                  <Text style={styles.choiceButtonText}>
                    {credentialType === 'pin' ? 'Switch to password' : 'Switch to PIN'}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.dangerButton}
                onPress={handleRemoveCredential}
                disabled={credentialBusy}>
                <Text style={styles.dangerButtonText}>Remove</Text>
              </Pressable>
            </View>
          ) : null}

          {!editorMode && !hasCredential ? (
            <View style={styles.credentialActions}>
              <Pressable
                style={styles.choiceButton}
                onPress={() => openEditor('pin')}
                disabled={credentialBusy}>
                <Text style={styles.choiceButtonText}>Set PIN</Text>
              </Pressable>
              <Pressable
                style={styles.choiceButton}
                onPress={() => openEditor('password')}
                disabled={credentialBusy}>
                <Text style={styles.choiceButtonText}>Set password</Text>
              </Pressable>
            </View>
          ) : null}

          {editorMode ? (
            <View style={styles.editor}>
              <Text style={styles.editorTitle}>
                {editorMode === 'pin' ? 'Set a 4-digit PIN' : 'Set a password'}
              </Text>

              {editorMode === 'pin' ? (
                <>
                  <Text style={styles.fieldLabel}>PIN</Text>
                  <OtpInput
                    length={PIN_LENGTH}
                    value={secret}
                    onChange={(value) => {
                      setSecret(value);
                      setCredentialError('');
                    }}
                    disabled={credentialBusy}
                    error={!!credentialError && secret.length === PIN_LENGTH}
                  />
                  <Text style={styles.fieldLabel}>Confirm PIN</Text>
                  <OtpInput
                    length={PIN_LENGTH}
                    value={confirmSecret}
                    onChange={(value) => {
                      setConfirmSecret(value);
                      setCredentialError('');
                    }}
                    disabled={credentialBusy}
                    error={!!credentialError}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={[styles.textInput, credentialError ? styles.textInputError : null]}
                    value={secret}
                    onChangeText={(value) => {
                      setSecret(value);
                      setCredentialError('');
                    }}
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                    placeholderTextColor={colors.gray400}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!credentialBusy}
                  />
                  <Text style={styles.fieldLabel}>Confirm password</Text>
                  <TextInput
                    style={[styles.textInput, credentialError ? styles.textInputError : null]}
                    value={confirmSecret}
                    onChangeText={(value) => {
                      setConfirmSecret(value);
                      setCredentialError('');
                    }}
                    placeholder="Re-enter password"
                    placeholderTextColor={colors.gray400}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!credentialBusy}
                  />
                </>
              )}

              {credentialError ? (
                <Text style={styles.inlineError}>{credentialError}</Text>
              ) : null}

              <View style={styles.credentialActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={resetEditor}
                  disabled={credentialBusy}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, credentialBusy && styles.buttonDisabled]}
                  onPress={() => void handleSaveCredential()}
                  disabled={credentialBusy}>
                  {credentialBusy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {credentialSuccess && !editorMode ? (
            <Text style={styles.methodNote}>{credentialSuccess}</Text>
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
  credentialStatus: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray50,
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
  editor: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray50,
  },
  editorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray600,
    fontFamily: 'Inter_500Medium',
    marginTop: spacing.xs,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  textInputError: {
    borderColor: colors.red500,
    backgroundColor: colors.red50,
  },
  inlineError: {
    fontSize: 13,
    color: colors.red500,
    fontFamily: 'Inter_500Medium',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  dangerButton: {
    flex: 1,
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
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.emerald600,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
