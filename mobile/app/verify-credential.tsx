import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppStackScreen } from '@/components/AppStackScreen';
import { OtpInput } from '@/components/OtpInput';
import { useAppLock } from '@/contexts/AppLockContext';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import { PIN_LENGTH, verifyAppLockCredential } from '@/lib/app-lock-credential';
import {
  clearCredentialChangeSession,
  markCredentialReauth,
  nextAfterVerify,
  type CredentialNext,
} from '@/lib/credential-setup';
import { colors, radius, spacing } from '@/constants/theme';

export default function VerifyCredentialScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const { user } = useAuth();
  const { credentialType } = useAppLock();
  const currentType = credentialType ?? user?.appLockType ?? null;
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [focused, setFocused] = useState(false);
  const advancing = useRef(false);

  useEffect(() => {
    if (user && !currentType) {
      router.replace('/security');
    }
  }, [user, currentType]);

  useFocusEffect(
    useCallback(() => {
      advancing.current = false;
    }, []),
  );

  const goNext = (value: string) => {
    const dest = nextAfterVerify(params.next as CredentialNext | undefined, currentType);
    markCredentialReauth(value);
    if (dest.params) {
      router.replace({ pathname: dest.pathname, params: dest.params });
      return;
    }
    router.replace(dest.pathname);
  };

  const submit = async (value: string) => {
    if (advancing.current || checking || !value) return;
    if (!currentType) {
      router.replace('/security');
      return;
    }

    advancing.current = true;
    setChecking(true);
    setError('');
    try {
      const ok = await verifyAppLockCredential(value);
      if (!ok) {
        setError(currentType === 'pin' ? 'Incorrect PIN' : 'Incorrect password');
        setSecret('');
        advancing.current = false;
        return;
      }
      goNext(value);
    } catch (err) {
      advancing.current = false;
      setSecret('');
      if (err instanceof ApiError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not verify');
    } finally {
      setChecking(false);
    }
  };

  const isPin = currentType === 'pin';
  const title = isPin ? 'Current PIN' : 'Current password';
  const prompt = isPin ? 'Enter your current PIN' : 'Enter your current password';
  const canContinue = isPin ? secret.length === PIN_LENGTH : secret.length > 0;

  return (
    <AppStackScreen
      title={title}
      onBack={() => {
        clearCredentialChangeSession();
        router.back();
      }}>
      <View style={styles.centerBlock}>
        <Text style={styles.prompt}>{prompt}</Text>
        {isPin ? (
          <OtpInput
            length={PIN_LENGTH}
            value={secret}
            onChange={(value) => {
              setSecret(value);
              setError('');
            }}
            onComplete={(value) => void submit(value)}
            disabled={checking}
            error={!!error}
            autoFocus
          />
        ) : (
          <View style={[styles.inputWrap, focused && styles.inputFocused, error ? styles.inputError : null]}>
            <TextInput
              style={styles.input}
              value={secret}
              onChangeText={(value) => {
                setSecret(value);
                setError('');
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Current password"
              placeholderTextColor={colors.gray400}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit(secret)}
              editable={!checking}
              autoFocus
            />
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {checking && isPin ? <ActivityIndicator style={styles.spinner} color={colors.emerald600} /> : null}
      </View>
      <Pressable
        style={[styles.primaryButton, (!canContinue || checking) && styles.buttonDisabled]}
        onPress={() => void submit(secret)}
        disabled={!canContinue || checking}>
        {checking && !isPin ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
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
  spinner: {
    marginTop: spacing.lg,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
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
