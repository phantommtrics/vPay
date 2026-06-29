import { API_URL } from './config';
import { getToken } from './auth-storage';
import type {
  CardFundTransactionSummary,
  CardsResponse,
  DocumentType,
  FundPrepareResponse,
  FundWalletCheckoutResponse,
  FundingOrderSummary,
  KycSubmitPayload,
  ProfileUpdate,
  User,
  VirtualCardSummary,
  WalletSummary,
  WalletTransactionSummary,
} from './types';
import type { FundConfig } from './fund-config';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (options.auth !== false) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Check that you have an active internet connection',
      0,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? 'Something went wrong', response.status);
  }

  return data as T;
}

export { ApiError };

export async function sendOtp(email: string): Promise<void> {
  await request('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
    auth: false,
  });
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ token: string; user: User }> {
  return request('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    auth: false,
  });
}

export async function fetchMe(): Promise<User> {
  const data = await request<{ user: User }>('/api/auth/me');
  return data.user;
}

export async function updateProfile(fields: ProfileUpdate): Promise<User> {
  const data = await request<{ user: User }>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return data.user;
}

export async function uploadKycDocument(
  side: 'front' | 'back',
  uri: string,
): Promise<User> {
  const token = await getToken();
  const form = new FormData();
  const filename = uri.split('/').pop() ?? `${side}.jpg`;

  form.append('file', {
    uri,
    type: 'image/jpeg',
    name: filename,
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/kyc/upload?side=${side}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Check that you have an active internet connection',
      0,
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error ?? 'Upload failed', response.status);
  }

  return (data as { user: User }).user;
}

export async function submitKyc(payload: KycSubmitPayload): Promise<User> {
  const data = await request<{ user: User }>('/api/kyc/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function fetchCards(): Promise<CardsResponse> {
  return request<CardsResponse>('/api/cards');
}

export async function getFundConfig(): Promise<FundConfig> {
  return request<FundConfig>('/api/fund/config');
}

export async function prepareFund(amountGmd: number): Promise<FundPrepareResponse> {
  return request<FundPrepareResponse>('/api/fund/prepare', {
    method: 'POST',
    body: JSON.stringify({ amountGmd }),
  });
}

export async function startFundWallet(
  fundingId: string,
  body: { gatewayCode: string; payerPhone?: string; gatewayId?: string },
): Promise<FundWalletCheckoutResponse> {
  return request<FundWalletCheckoutResponse>(`/api/fund/${fundingId}/wallet`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function authorizeFundAps(
  fundingId: string,
  body: { gatewayCode: string; payerMobile: string },
): Promise<{ ok: boolean; authState: string; requiresOtp: boolean }> {
  return request(`/api/fund/${fundingId}/aps/authorize`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function completeFundAps(
  fundingId: string,
  body: { gatewayCode: string; authState: string; otp?: string },
): Promise<{ ok: boolean; data: unknown }> {
  return request(`/api/fund/${fundingId}/aps/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function simulateFund(
  fundingId: string,
  gatewayCode?: string,
): Promise<{
  ok: boolean;
  funding: FundingOrderSummary;
  wallet: WalletSummary;
  walletTransactionId: string;
}> {
  return request(`/api/fund/${fundingId}/simulate`, {
    method: 'POST',
    body: JSON.stringify(gatewayCode ? { gatewayCode } : {}),
  });
}

export async function getWallet(): Promise<{ wallet: WalletSummary }> {
  return request('/api/wallet');
}

export async function getWalletTransactions(params?: {
  cursor?: string;
  limit?: number;
}): Promise<{ transactions: WalletTransactionSummary[]; nextCursor: string | null }> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return request(`/api/wallet/transactions${query ? `?${query}` : ''}`);
}

export async function fundCardFromWallet(amountGmd: number): Promise<{
  ok: boolean;
  transaction: CardFundTransactionSummary;
  card: { balanceUsd: number; balanceGmdEstimate: number; balanceSource: string };
  wallet: WalletSummary;
}> {
  return request('/api/card-fund', {
    method: 'POST',
    body: JSON.stringify({ amountGmd }),
  });
}

export async function getCardFundTransactions(params?: {
  cursor?: string;
  limit?: number;
}): Promise<{ transactions: CardFundTransactionSummary[]; nextCursor: string | null }> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return request(`/api/card-fund/transactions${query ? `?${query}` : ''}`);
}

export async function getFundingOrder(fundingId: string): Promise<{ funding: FundingOrderSummary }> {
  return request(`/api/fund/${fundingId}`);
}

export async function updateCardStatus(
  cardId: string,
  status: 'active' | 'inactive',
): Promise<VirtualCardSummary> {
  const data = await request<{ card: VirtualCardSummary }>(`/api/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return data.card;
}

export async function createEphemeralKey(
  cardId: string,
  nonce: string,
): Promise<{
  ephemeralKeySecret: string;
  stripeCardId: string;
  stripeConnectedAccountId: string | null;
  stripePublishableKey: string | null;
}> {
  return request(`/api/cards/${cardId}/ephemeral-key`, {
    method: 'POST',
    body: JSON.stringify({ nonce }),
  });
}

export function issuingElementsUrl(params?: {
  publishableKey?: string | null;
  stripeAccount?: string | null;
  layout?: 'full' | 'card' | 'number' | 'cvc' | 'copy';
  holder?: string | null;
  expiry?: string | null;
}): string {
  const search = new URLSearchParams();
  if (params?.publishableKey) {
    search.set('pk', params.publishableKey);
  }
  if (params?.stripeAccount) {
    search.set('account', params.stripeAccount);
  }
  if (params?.layout) {
    search.set('layout', params.layout);
  }
  if (params?.holder) {
    search.set('holder', params.holder);
  }
  if (params?.expiry) {
    search.set('expiry', params.expiry);
  }
  const query = search.toString();
  return `${API_URL}/issuing-elements${query ? `?${query}` : ''}`;
}

export function assetUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

export function hasDisplayName(user: User): boolean {
  return Boolean(user.firstName?.trim());
}

export function getUserDisplayName(user: User): string | null {
  if (!user.firstName?.trim()) return null;
  return user.lastName?.trim()
    ? `${user.firstName} ${user.lastName.charAt(0)}.`
    : user.firstName;
}

export function getUserInitials(user: User): string | null {
  if (user.firstName?.trim() && user.lastName?.trim()) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName?.trim()) {
    return user.firstName.slice(0, 2).toUpperCase();
  }
  return null;
}
