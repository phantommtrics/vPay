import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function isDevHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return DEV_HOSTS.has(hostname);
  } catch {
    return true;
  }
}

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return normalizeUrl(envUrl);
  }

  if (!__DEV__) {
    // Standalone release builds must bake in a public API URL at build time.
    return '';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost;

  if (hostUri) {
    const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
    if (host && !DEV_HOSTS.has(host)) {
      return `http://${host}:3001`;
    }
  }

  const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${devHost}:3001`;
}

export const API_URL = resolveApiUrl();

export function getConfigError(): string | null {
  if (__DEV__) {
    return null;
  }

  if (!API_URL) {
    return 'This build is missing EXPO_PUBLIC_API_URL. Rebuild the app with your production API URL configured in EAS secrets or mobile/.env.';
  }

  if (isDevHost(API_URL)) {
    return 'This build is pointing at a development server. Rebuild with your production API URL before publishing to the Play Store.';
  }

  return null;
}
