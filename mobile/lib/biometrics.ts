import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, InteractionManager, Platform } from 'react-native';

export type BiometricMethod = 'faceId' | 'touchId' | 'androidBiometric' | 'none';

export async function waitForAppActive(): Promise<void> {
  await new Promise<void>((resolve) => {
    const run = () => InteractionManager.runAfterInteractions(() => resolve());

    if (AppState.currentState === 'active') {
      run();
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        subscription.remove();
        run();
      }
    });
  });
}

export async function resolveBiometricMethod(): Promise<BiometricMethod> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  if (!hasHardware || !isEnrolled) {
    return 'none';
  }

  if (Platform.OS === 'ios') {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'faceId';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'touchId';
    }
    // Hardware reports enrolled but types empty — still attempt native biometrics on iOS.
    if (hasHardware && isEnrolled) {
      return 'faceId';
    }
    return 'none';
  }

  if (hasHardware && isEnrolled) {
    return 'androidBiometric';
  }

  return 'none';
}

export function getBiometricLabel(method: BiometricMethod): string {
  switch (method) {
    case 'faceId':
      return 'Face ID';
    case 'touchId':
      return 'Touch ID';
    case 'androidBiometric':
      return 'Biometrics';
    default:
      return '';
  }
}

export function getLockHint(
  method: BiometricMethod,
  credentialType?: 'pin' | 'password' | null,
): string {
  switch (method) {
    case 'faceId':
      return 'Face ID is required to unlock';
    case 'touchId':
      return 'Touch ID is required to unlock';
    case 'androidBiometric':
      return 'Biometric authentication required';
    default:
      if (credentialType === 'pin') return 'Enter your PIN to unlock';
      if (credentialType === 'password') return 'Enter your password to unlock';
      return 'Sign in to continue';
  }
}

function getPromptMessage(method: BiometricMethod): string {
  switch (method) {
    case 'faceId':
      return 'Unlock vPay with Face ID';
    case 'touchId':
      return 'Unlock vPay with Touch ID';
    case 'androidBiometric':
      return 'Unlock vPay';
    default:
      return 'Unlock vPay';
  }
}

export function getAuthenticateOptions(
  method: BiometricMethod,
): LocalAuthentication.LocalAuthenticationOptions {
  if (Platform.OS === 'ios') {
    return {
      promptMessage: getPromptMessage(method),
      // Biometrics only — no device passcode. Email sign-in is the app fallback.
      disableDeviceFallback: true,
      fallbackLabel: '',
    };
  }

  return {
    promptMessage: getPromptMessage(method),
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
    requireConfirmation: false,
    cancelLabel: 'Use email',
  };
}

export async function authenticateWithBiometrics(
  method: BiometricMethod,
): Promise<LocalAuthentication.LocalAuthenticationResult> {
  await waitForAppActive();
  return LocalAuthentication.authenticateAsync(getAuthenticateOptions(method));
}
