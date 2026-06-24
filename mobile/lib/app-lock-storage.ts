import * as SecureStore from 'expo-secure-store';

const APP_LOCK_ENABLED_KEY = 'vpay_app_lock_enabled';

export async function getAppLockEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY);
  if (value === null) return true;
  return value === 'true';
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
}

let skipNextAppLock = false;

/** Call after a fresh OTP sign-in so the user is not prompted again immediately. */
export function markSkipNextAppLock(): void {
  skipNextAppLock = true;
}

export function consumeSkipNextAppLock(): boolean {
  const shouldSkip = skipNextAppLock;
  skipNextAppLock = false;
  return shouldSkip;
}
