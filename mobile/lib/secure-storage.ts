import { Platform } from 'react-native';

function webStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function nativeStore() {
  return import('expo-secure-store');
}

/** SecureStore on native. localStorage on web, where the native module is unavailable. */
export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(key) ?? null;
  }
  const SecureStore = await nativeStore();
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(key, value);
    return;
  }
  const SecureStore = await nativeStore();
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key);
    return;
  }
  const SecureStore = await nativeStore();
  await SecureStore.deleteItemAsync(key);
}
