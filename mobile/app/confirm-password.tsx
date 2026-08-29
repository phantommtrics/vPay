import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppStackScreen } from '@/components/AppStackScreen';
import { useAppLock } from '@/contexts/AppLockContext';
import { PASSWORD_MIN_LENGTH } from '@/lib/app-lock-credential';
import { credentialSaveMessage, getStagedCredential, isCredentialFlowComplete, markCredentialFlowComplete } from '@/lib/credential-setup';
import { colors, radius, spacing } from '@/constants/theme';

function leaveCredentialFlow() {
  if (router.canDismiss()) {
    router.dismissTo('/security');
    return;
  }
  router.replace('/security');
}

export default function ConfirmPasswordScreen() {
  const { credentialType, setCredential } = useAppLock();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState(false);
  const [message, setMessage] = useState({ title: 'Password saved', subtitle: '' });

  useEffect(() => {
    const current = getStagedCredential();
    if (!current || current.type !== 'password') {
      if (!isCredentialFlowComplete()) {
        leaveCredentialFlow();
      }
    }
  }, []);

  const confirm = async () => {
    const expected = getStagedCredential();
    if (!expected || expected.type !== 'password' || saving || saved) return;

    if (password !== expected.secret) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const previousType = credentialType;
      await setCredential('password', password);
      markCredentialFlowComplete();
      setMessage(credentialSaveMessage('password', previousType));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save password');
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
    <AppStackScreen title="Confirm password">
      <View style={styles.centerBlock}>
        <Text style={styles.prompt}>Re-enter your password</Text>
        <View style={[styles.inputWrap, focused && styles.inputFocused, error ? styles.inputError : null]}>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError('');
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Re-enter password"
            placeholderTextColor={colors.gray400}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void confirm()}
            editable={!saving}
            autoFocus
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        style={[
          styles.primaryButton,
          (saving || password.length < PASSWORD_MIN_LENGTH) && styles.buttonDisabled,
        ]}
        onPress={() => void confirm()}
        disabled={saving || password.length < PASSWORD_MIN_LENGTH}>
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Confirm</Text>
        )}
      </Pressable>
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
  inputWrap: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  inputFocused: {
    borderColor: colors.emerald600,
  },
  inputError: {
    borderColor: colors.red500,
    backgroundColor: colors.red50,
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.gray900,
    fontFamily: 'Inter_400Regular',
  },
  error: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.red500,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
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
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.emerald600,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
