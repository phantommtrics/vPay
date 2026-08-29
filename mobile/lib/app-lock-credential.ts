import * as SecureStore from 'expo-secure-store';

import {
  ApiError,
  clearAppLockCredentialRemote,
  setAppLockCredentialRemote,
  verifyAppLockCredentialRemote,
} from '@/lib/api';
import { clearCredentialReauth, getCurrentSecret } from '@/lib/credential-setup';

const CREDENTIAL_KEY = 'vpay_app_lock_credential';

export type AppLockCredentialType = 'pin' | 'password';

export const PIN_LENGTH = 4;
export const PASSWORD_MIN_LENGTH = 8;

type StoredCredential = {
  type: AppLockCredentialType;
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

async function readLocalCredential(): Promise<StoredCredential | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredCredential(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLocalAppLockCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIAL_KEY);
}

/** Upload a leftover on-device PIN/password once, then delete the local copy. */
export async function migrateLocalAppLockCredential(
  serverType: AppLockCredentialType | null | undefined,
): Promise<boolean> {
  const local = await readLocalCredential();
  if (!local) return false;

  if (serverType) {
    await clearLocalAppLockCredential();
    return false;
  }

  try {
    await setAppLockCredentialRemote(local.type, local.secret);
    await clearLocalAppLockCredential();
    return true;
  } catch {
    return false;
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

  await setAppLockCredentialRemote(type, secret, getCurrentSecret());
  await clearLocalAppLockCredential();
  clearCredentialReauth();
}

export async function clearAppLockCredential(): Promise<void> {
  await clearAppLockCredentialRemote();
  await clearLocalAppLockCredential();
}

export async function verifyAppLockCredential(secret: string): Promise<boolean> {
  try {
    await verifyAppLockCredentialRemote(secret);
    return true;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 429 || error.status === 0)) {
      throw error;
    }
    return false;
  }
}
