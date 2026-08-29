import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppStackScreen } from '@/components/AppStackScreen';
import { OtpInput } from '@/components/OtpInput';
import { useAppLock } from '@/contexts/AppLockContext';
import { PIN_LENGTH } from '@/lib/app-lock-credential';
import { credentialSaveMessage, getStagedCredential, isCredentialFlowComplete, markCredentialFlowComplete } from '@/lib/credential-setup';
import { colors, radius, spacing } from '@/constants/theme';

function leaveCredentialFlow() {
  if (router.canDismiss()) {
    router.dismissTo('/security');
    return;
  }
  router.replace('/security');
}

export default function ConfirmPinScreen() {
  const { credentialType, setCredential } = useAppLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState({ title: 'PIN saved', subtitle: '' });

  useEffect(() => {
    const current = getStagedCredential();
    if (!current || current.type !== 'pin') {
      if (!isCredentialFlowComplete()) {
        leaveCredentialFlow();
      }
    }
  }, []);

  const confirm = async (value: string) => {
    const expected = getStagedCredential();
    if (!expected || expected.type !== 'pin' || saving || saved) return;

    if (value !== expected.secret) {
      setError('PINs do not match');
      setPin('');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const previousType = credentialType;
      await setCredential('pin', value);
      markCredentialFlowComplete();
      setMessage(credentialSaveMessage('pin', previousType));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save PIN');
      setPin('');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <AppStackScreen title="Success" onBack={leaveCredentialFlow}>
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={40} color={colors.emerald600} />
          </View>
          <Text style={styles.successTitle}>{message.title}</Text>
          {message.subtitle ? <Text style={styles.successSubtitle}>{message.subtitle}</Text> : null}
          <Pressable style={styles.doneButton} onPress={leaveCredentialFlow}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      </AppStackScreen>
    );
  }

  return (
    <AppStackScreen title="Confirm PIN">
      <View style={styles.centerBlock}>
        <Text style={styles.prompt}>Re-enter your PIN</Text>
        <OtpInput
          length={PIN_LENGTH}
          value={pin}
          onChange={(value) => {
            setPin(value);
            setError('');
          }}
          onComplete={(value) => void confirm(value)}
          disabled={saving}
          error={!!error}
          autoFocus
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saving ? <ActivityIndicator style={styles.spinner} color={colors.emerald600} /> : null}
      </View>
    </AppStackScreen>
  );
}

const styles = StyleSheet.create({
  prompt: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontFamily: 'Inter_600SemiBold',
  },
  error: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  spinner: {
    marginTop: spacing.lg,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  success: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.emerald600,
    marginTop: spacing.md,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
