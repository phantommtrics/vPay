import type { AppLockCredentialType } from '@/lib/app-lock-credential';

let stagedType: AppLockCredentialType | null = null;
let stagedSecret: string | null = null;
let currentSecret: string | null = null;
let reauthUntil = 0;

const REAUTH_MS = 5 * 60 * 1000;

export type CredentialNext = 'change' | 'switch-pin' | 'switch-password';

export function stageCredential(type: AppLockCredentialType, secret: string) {
  stagedType = type;
  stagedSecret = secret;
}

export function getStagedCredential(): { type: AppLockCredentialType; secret: string } | null {
  if (!stagedType || stagedSecret == null) return null;
  return { type: stagedType, secret: stagedSecret };
}

export function clearStagedCredential() {
  stagedType = null;
  stagedSecret = null;
}

export function markCredentialReauth(secret: string) {
  currentSecret = secret;
  reauthUntil = Date.now() + REAUTH_MS;
}

export function hasCredentialReauth(): boolean {
  if (!currentSecret || Date.now() > reauthUntil) {
    currentSecret = null;
    reauthUntil = 0;
    return false;
  }
  return true;
}

export function getCurrentSecret(): string | undefined {
  return hasCredentialReauth() ? currentSecret ?? undefined : undefined;
}

export function clearCredentialReauth() {
  currentSecret = null;
  reauthUntil = 0;
}

export function clearCredentialChangeSession() {
  clearStagedCredential();
  clearCredentialReauth();
}

let flowCompleteUntil = 0;

export function markCredentialFlowComplete() {
  clearCredentialChangeSession();
  flowCompleteUntil = Date.now() + 15_000;
}

export function isCredentialFlowComplete(): boolean {
  return Date.now() < flowCompleteUntil;
}

export function reauthNextForSetScreen(
  screen: AppLockCredentialType,
  mode: string | undefined,
  currentType: AppLockCredentialType | null,
): CredentialNext {
  if (mode === 'change' || currentType === screen) return 'change';
  return screen === 'pin' ? 'switch-pin' : 'switch-password';
}

export function nextAfterVerify(
  next: CredentialNext | string | undefined,
  currentType: AppLockCredentialType | null,
): { pathname: '/set-pin' | '/set-password'; params?: { mode: string } } {
  if (next === 'switch-pin') return { pathname: '/set-pin' };
  if (next === 'switch-password') return { pathname: '/set-password' };
  if (currentType === 'password') {
    return { pathname: '/set-password', params: { mode: 'change' } };
  }
  return { pathname: '/set-pin', params: { mode: 'change' } };
}

export function credentialSaveMessage(
  nextType: AppLockCredentialType,
  previousType: AppLockCredentialType | null,
): { title: string; subtitle: string } {
  if (!previousType) {
    return nextType === 'pin'
      ? { title: 'PIN saved', subtitle: 'Use this PIN to unlock the app.' }
      : { title: 'Password saved', subtitle: 'Use this password to unlock the app.' };
  }
  if (previousType === nextType) {
    return nextType === 'pin'
      ? { title: 'PIN updated', subtitle: 'Your new PIN is now in use.' }
      : { title: 'Password updated', subtitle: 'Your new password is now in use.' };
  }
  return nextType === 'pin'
    ? { title: 'Switched to PIN', subtitle: 'Password unlock is off. Use your new PIN from now on.' }
    : { title: 'Switched to password', subtitle: 'PIN unlock is off. Use your new password from now on.' };
}
