import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppStackScreen } from '@/components/AppStackScreen';
import { OtpInput } from '@/components/OtpInput';
import { useCredentialSetGuard } from '@/hooks/useCredentialSetGuard';
import { PIN_LENGTH, validatePin } from '@/lib/app-lock-credential';
import { clearStagedCredential, stageCredential } from '@/lib/credential-setup';
import { colors, radius, spacing } from '@/constants/theme';

export default function SetPinScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = typeof params.mode === 'string' ? params.mode : undefined;
  const isChange = mode === 'change';
  const allowed = useCredentialSetGuard('pin', mode);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const advancing = useRef(false);

  useFocusEffect(
    useCallback(() => {
      advancing.current = false;
    }, []),
  );

  const goToConfirm = (value: string) => {
    if (advancing.current) return;
    const validationError = validatePin(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    advancing.current = true;
    stageCredential('pin', value);
    router.push('/confirm-pin');
  };

  if (!allowed) return null;

  return (
    <AppStackScreen
      title={isChange ? 'Change PIN' : 'Set PIN'}
      onBack={() => {
        clearStagedCredential();
        router.back();
      }}>
      <View style={styles.centerBlock}>
        <Text style={styles.prompt}>Enter a 4-digit PIN</Text>
        <OtpInput
          length={PIN_LENGTH}
          value={pin}
          onChange={(value) => {
            setPin(value);
            setError('');
          }}
          onComplete={goToConfirm}
          error={!!error}
          autoFocus
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Pressable
        style={[styles.primaryButton, pin.length !== PIN_LENGTH && styles.buttonDisabled]}
        onPress={() => goToConfirm(pin)}
        disabled={pin.length !== PIN_LENGTH}>
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
