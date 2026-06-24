import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost;

  if (hostUri) {
    const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3001`;
    }
  }

  const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${devHost}:3001`;
}

export const API_URL = resolveApiUrl();
