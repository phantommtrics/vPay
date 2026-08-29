import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppStackScreen } from '@/components/AppStackScreen';
import { useCredentialSetGuard } from '@/hooks/useCredentialSetGuard';
import { PASSWORD_MIN_LENGTH, validatePassword } from '@/lib/app-lock-credential';
import { clearStagedCredential, stageCredential } from '@/lib/credential-setup';
import { colors, radius, spacing } from '@/constants/theme';

export default function SetPasswordScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = typeof params.mode === 'string' ? params.mode : undefined;
  const isChange = mode === 'change';
  const allowed = useCredentialSetGuard('password', mode);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const goToConfirm = () => {
    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    stageCredential('password', password);
    router.push('/confirm-password');
  };

  if (!allowed) return null;

  return (
    <AppStackScreen
      title={isChange ? 'Change password' : 'Set password'}
      onBack={() => {
        clearStagedCredential();
        router.back();
      }}>
      <View style={styles.centerBlock}>
        <Text style={styles.prompt}>Create a password</Text>
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
            placeholder={`${PASSWORD_MIN_LENGTH}+ characters`}
            placeholderTextColor={colors.gray400}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            autoComplete="password-new"
            returnKeyType="next"
            onSubmitEditing={goToConfirm}
            autoFocus
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        style={[styles.primaryButton, password.length < PASSWORD_MIN_LENGTH && styles.buttonDisabled]}
        onPress={goToConfirm}
        disabled={password.length < PASSWORD_MIN_LENGTH}>
        <Text style={styles.primaryButtonText}>Continue</Text>
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
