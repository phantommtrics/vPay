import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/secure-storage';

const TOKEN_KEY = 'vpay_auth_token';

export async function getToken(): Promise<string | null> {
  return getSecureItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await setSecureItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await deleteSecureItem(TOKEN_KEY);
}
