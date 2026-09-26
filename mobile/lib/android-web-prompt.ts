import { Platform } from 'react-native';

const DISMISS_KEY = 'vpay.web.androidPromptDismissed';
const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=gm.phantommetrics.vpay';

export function androidStoreUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ANDROID_STORE_URL?.trim();
  return fromEnv || DEFAULT_STORE_URL;
}

export function isAndroidBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return true;
  const data = (
    navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } }
  ).userAgentData;
  return Boolean(data?.mobile && /android/i.test(data.platform ?? ''));
}

export function androidPromptDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissAndroidPrompt() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Private mode can block storage; the sheet still closes for this visit.
  }
}
