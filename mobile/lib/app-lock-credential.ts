import * as SecureStore from 'expo-secure-store';

const CREDENTIAL_KEY = 'vpay_app_lock_credential';

export type AppLockCredentialType = 'pin' | 'password';

export const PIN_LENGTH = 4;
export const PASSWORD_MIN_LENGTH = 8;

type StoredCredential = {
  type: AppLockCredentialType;
  /** Stored in SecureStore (OS keychain / keystore encryption). */
  secret: string;
};

export type AppLockCredentialInfo = {
  type: AppLockCredentialType;
};

function isStoredCredential(value: unknown): value is StoredCredential {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record.type === 'pin' || record.type === 'password') &&
    typeof record.secret === 'string' &&
    record.secret.length > 0
  );
}

export function validatePin(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) {
    return 'PIN must be exactly 4 digits';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  return null;
}

export function validateCredential(type: AppLockCredentialType, value: string): string | null {
  return type === 'pin' ? validatePin(value) : validatePassword(value);
}

export async function getAppLockCredentialInfo(): Promise<AppLockCredentialInfo | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredCredential(parsed)) return null;
    return { type: parsed.type };
  } catch {
    return null;
  }
}

export async function setAppLockCredential(
  type: AppLockCredentialType,
  secret: string,
): Promise<void> {
  const validationError = validateCredential(type, secret);
  if (validationError) {
    throw new Error(validationError);
  }

  const payload: StoredCredential = { type, secret };
  await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(payload));
}

export async function clearAppLockCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
}

export async function verifyAppLockCredential(secret: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
  if (!raw) return false;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredCredential(parsed)) return false;
    return parsed.secret === secret;
  } catch {
    return false;
  }
}
