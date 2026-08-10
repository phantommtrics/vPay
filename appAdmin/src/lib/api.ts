export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type AdminProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  adminUser: boolean;
  adminUserType: 'OWNER' | 'OPERATOR' | null;
  adminUserStatus: 'ACTIVE' | 'DISABLED';
  totpEnrolled: boolean;
  permissions: string[];
};

export type KycStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';
export type ProvisioningStatus = 'none' | 'pending' | 'active' | 'failed';
export type AccountStatus = 'active' | 'blocked' | 'terminated';

export type AdminUserSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  accountStatus: AccountStatus;
  kycStatus: KycStatus;
  kycComplete: boolean;
  kycSubmittedAt: string | null;
  documentType: string | null;
  country: string | null;
  stripeProvisioningStatus: ProvisioningStatus;
  directPayProvisioningStatus: ProvisioningStatus;
  directPayBusinessId: string | null;
  createdAt: string;
};

export type AdminUserDevice = {
  id: string;
  fingerprint: string;
  deviceName: string | null;
  brand: string | null;
  manufacturer: string | null;
  modelName: string | null;
  deviceType: string | null;
  osName: string | null;
  osVersion: string | null;
  hardwareId: string | null;
  imei: string | null;
  isEmulator: boolean;
  appVersion: string | null;
  lastIpAddress: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type CustomerDeviceGroupSummary = {
  groupKey: string;
  groupType: 'hardware' | 'device';
  hardwareId: string | null;
  representativeDeviceId: string;
  userCount: number;
  deviceName: string | null;
  brand: string | null;
  modelName: string | null;
  osName: string | null;
  osVersion: string | null;
  isEmulator: boolean;
  lastSeenAt: string;
};

export type CustomerDeviceLinkedUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  kycStatus: KycStatus;
  kycComplete: boolean;
  kycSubmittedAt: string | null;
  documentType: string | null;
  country: string | null;
  deviceRecordId: string;
  deviceLastSeenAt: string;
};

export type CustomerDeviceGroupDetail = {
  groupKey: string;
  groupType: 'hardware' | 'device';
  hardwareId: string | null;
  userCount: number;
  devices: AdminUserDevice[];
  users: CustomerDeviceLinkedUser[];
};

export type AdminUser = AdminUserSummary & {
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  kycRejectionReason: string | null;
  cardTermsAcceptedAt: string | null;
  stripeProvisioningError: string | null;
  stripeConnectedAccountId: string | null;
  directPayProvisioningError: string | null;
  directPaySlug: string | null;
  cardIssuancePaidAt: string | null;
  cardIssuanceFeeUsd: number | null;
  virtualCardCount: number;
  latestCardLast4: string | null;
  hasActiveCard: boolean;
  cards: AdminCardSummary[];
  kycSubmittedDevice: AdminUserDevice | null;
  lockedDevice: AdminUserDevice | null;
  deviceLockEnabled: boolean;
  monthlyDevicesUsed: number;
  monthlyDevicesLimit: number;
  blockedAt: string | null;
  blockedReason: string | null;
  terminatedAt: string | null;
  originalEmail: string | null;
};

export type AdminCardSummary = {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: 'active' | 'inactive' | 'canceled';
  expired: boolean;
  frozen: boolean;
};

export type AdminStats = {
  pendingKyc: number;
  activeCards: number;
  totalUsers: number;
  walletsWithBalance: number;
  totalWalletBalanceGmd: number;
  pendingFundingOrders: number;
  depositsLast7Days: number;
  directPayMerchantEmail: string | null;
};

export type WalletTransaction = {
  id: string;
  type: string;
  amountGmd: number;
  balanceBeforeGmd: number;
  balanceAfterGmd: number;
  usdEstimate: number | null;
  exchangeRate: number | null;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  fundingSource: string | null;
  fundingSourceLabel: string | null;
  createdAt: string;
};

export type AdminWallet = {
  id: string;
  phoneNumber: string;
  balanceGmd: number;
  usdEstimate: number;
  exchangeRate: number;
  createdAt: string;
  updatedAt: string;
};

export type FundingOrder = {
  id: string;
  userId: string;
  amountGmd: number;
  feeGmd: number;
  totalGmd: number;
  usdEstimate: number;
  status: string;
  directPayOrderId: string | null;
  directPayOrderPublicCode: string | null;
  directPayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PlatformActivity = {
  walletTransactions: Array<{
    id: string;
    type: string;
    amountGmd: number;
    balanceAfterGmd: number;
    description: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: string;
    user: { id: string; email: string; firstName: string | null; lastName: string | null };
  }>;
  fundingOrders: Array<FundingOrder & {
    user: { id: string; email: string; firstName: string | null; lastName: string | null };
  }>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export function assetUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Relative URLs use the Vite dev proxy (/uploads → backend) in development.
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null; preAuth?: string | null } = {},
): Promise<T> {
  const { token, preAuth, ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (preAuth) {
    headers.set('Authorization', `Bearer ${preAuth}`);
  }

  const res = await fetch(resolveUrl(path), { ...init, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error ?? 'Request failed', res.status);
  }

  return data as T;
}

export function sendAdminOtp(email: string) {
  return request<{ ok: boolean }>('/api/admin/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function verifyAdminOtp(email: string, code: string) {
  return request<{
    preAuthToken: string;
    totpEnrolled: boolean;
    admin: AdminProfile;
  }>('/api/admin/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function setupAdminTotp(preAuthToken: string) {
  return request<{ secret: string; qrDataUrl: string; manualEntryKey: string }>(
    '/api/admin/auth/setup-totp',
    { method: 'POST', preAuth: preAuthToken, body: '{}' },
  );
}

export function confirmAdminTotp(preAuthToken: string, secret: string, code: string) {
  return request<{ token: string; admin: AdminProfile }>('/api/admin/auth/confirm-totp', {
    method: 'POST',
    preAuth: preAuthToken,
    body: JSON.stringify({ secret, code }),
  });
}

export function verifyAdminTotp(preAuthToken: string, code: string) {
  return request<{ token: string; admin: AdminProfile }>('/api/admin/auth/verify-totp', {
    method: 'POST',
    preAuth: preAuthToken,
    body: JSON.stringify({ code }),
  });
}

export function fetchAdminMe(token: string) {
  return request<{ admin: AdminProfile }>('/api/admin/auth/me', { token });
}

export function fetchAdminStats(token: string) {
  return request<{ stats: AdminStats }>('/api/admin/stats', { token });
}

export function fetchAdminUsers(
  token: string,
  params: {
    kycStatus?: KycStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const qs = new URLSearchParams();
  if (params.kycStatus) qs.set('kycStatus', params.kycStatus);
  if (params.search) qs.set('search', params.search);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<{
    users: AdminUserSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/api/admin/users${query ? `?${query}` : ''}`, { token });
}

export function fetchAdminUser(token: string, userId: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${userId}`, { token });
}

export function fetchUserDevices(token: string, userId: string) {
  return request<{ devices: AdminUserDevice[] }>(`/api/admin/users/${userId}/devices`, { token });
}

export function unlockAdminUserDevice(token: string, userId: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${userId}/unlock-device`, {
    method: 'POST',
    token,
  });
}

export function blockAdminUser(token: string, userId: string, reason?: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${userId}/block`, {
    method: 'POST',
    token,
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export function unblockAdminUser(token: string, userId: string) {
  return request<{ user: AdminUser }>(`/api/admin/users/${userId}/unblock`, {
    method: 'POST',
    token,
    body: '{}',
  });
}

export function terminateAdminUser(token: string, userId: string, reason?: string) {
  return request<{ user: AdminUser; zeroedBalanceGmd: number }>(
    `/api/admin/users/${userId}/terminate`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export function fetchCustomerDeviceGroups(
  token: string,
  params: { search?: string; page?: number; limit?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<{
    groups: CustomerDeviceGroupSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/api/admin/customer-devices${query ? `?${query}` : ''}`, { token });
}

export function fetchCustomerDeviceGroup(
  token: string,
  groupType: 'hardware' | 'device',
  groupKey: string,
) {
  return request<{ group: CustomerDeviceGroupDetail }>(
    `/api/admin/customer-devices/${groupType}/${encodeURIComponent(groupKey)}`,
    { token },
  );
}

export function lookupAdminUser(token: string, email: string) {
  return request<{ user: AdminUser }>(
    `/api/admin/users/lookup?email=${encodeURIComponent(email)}`,
    { token },
  );
}

export function approveKyc(token: string, userId: string) {
  return request<{ user: AdminUser }>(`/api/admin/kyc/${userId}/approve`, {
    method: 'POST',
    token,
    body: '{}',
  });
}

export function rejectKyc(token: string, userId: string, reason: string) {
  return request<{ user: AdminUser }>(`/api/admin/kyc/${userId}/reject`, {
    method: 'POST',
    token,
    body: JSON.stringify({ reason }),
  });
}

export function provisionCard(token: string, userId: string, charge: boolean) {
  return request<{ user: AdminUser }>(`/api/admin/kyc/${userId}/provision-card`, {
    method: 'POST',
    token,
    body: JSON.stringify({ charge }),
  });
}

export function provisionDirectPay(token: string, userId: string) {
  return request<{ user: AdminUser }>(`/api/admin/kyc/${userId}/provision-directpay`, {
    method: 'POST',
    token,
    body: '{}',
  });
}

export function fetchUserWallet(token: string, userId: string) {
  return request<{
    wallet: AdminWallet | null;
    card: { balanceUsd: number; balanceGmdEstimate: number; balanceSource: string } | null;
  }>(`/api/admin/users/${userId}/wallet`, { token });
}

export function fetchUserWalletTransactions(
  token: string,
  userId: string,
  params: { cursor?: string; limit?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<{ transactions: WalletTransaction[]; nextCursor: string | null }>(
    `/api/admin/users/${userId}/wallet/transactions${query ? `?${query}` : ''}`,
    { token },
  );
}

export function fetchUserFundingOrders(token: string, userId: string, limit = 25) {
  return request<{ orders: FundingOrder[]; nextCursor: string | null }>(
    `/api/admin/users/${userId}/funding-orders?limit=${limit}`,
    { token },
  );
}

export function fetchPlatformActivity(token: string, limit = 30) {
  return request<PlatformActivity>(`/api/admin/activity?limit=${limit}`, { token });
}

export type ReportWalletTransaction = PlatformActivity['walletTransactions'][number];

export type ReportFundingOrder = PlatformActivity['fundingOrders'][number];

export function fetchReportWalletTransactions(
  token: string,
  params: { cursor?: string; limit?: number; startDate?: string; endDate?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  const query = qs.toString();
  return request<{ transactions: ReportWalletTransaction[]; nextCursor: string | null; limit: number }>(
    `/api/admin/reports/wallet-transactions${query ? `?${query}` : ''}`,
    { token },
  );
}

export function fetchReportFundingOrders(
  token: string,
  params: { cursor?: string; limit?: number; startDate?: string; endDate?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  const query = qs.toString();
  return request<{ orders: ReportFundingOrder[]; nextCursor: string | null; limit: number }>(
    `/api/admin/reports/funding-orders${query ? `?${query}` : ''}`,
    { token },
  );
}

export type JournalLineRecord = {
  id: string;
  accountType: 'CUSTOMER_WALLET' | 'BUSINESS_ACCOUNT';
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  walletTransactionId: string | null;
  businessAccountTransactionId: string | null;
  sortOrder: number;
};

export type JournalEntryRecord = {
  id: string;
  referenceType: string;
  referenceId: string;
  description: string | null;
  postedAt: string;
  createdAt: string;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
  lines?: JournalLineRecord[];
};

export type TrialBalanceRow = {
  accountType: 'CUSTOMER_WALLET' | 'BUSINESS_ACCOUNT';
  accountId: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  accountCode: string;
  accountName: string;
  liveBalance: number | null;
  currency: string;
  entityName?: string | null;
};

export function fetchReportJournalEntries(
  token: string,
  params: { cursor?: string; limit?: number; startDate?: string; endDate?: string; referenceType?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.referenceType) qs.set('referenceType', params.referenceType);
  const query = qs.toString();
  return request<{ items: JournalEntryRecord[]; nextCursor: string | null; hasMore: boolean; startDate: string; endDate: string }>(
    `/api/admin/reports/journal-entries${query ? `?${query}` : ''}`,
    { token },
  );
}

export function fetchReportJournalEntryDetail(token: string, entryId: string) {
  return request<JournalEntryRecord>(`/api/admin/reports/journal-entries/${entryId}`, { token });
}

export function fetchReportTrialBalance(
  token: string,
  params: { cursor?: string; limit?: number; startDate?: string; endDate?: string; accountType?: 'CUSTOMER_WALLET' | 'BUSINESS_ACCOUNT' } = {},
) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.accountType) qs.set('accountType', params.accountType);
  const query = qs.toString();
  return request<{
    rows: TrialBalanceRow[];
    totals: { totalDebit: number; totalCredit: number; balanced: boolean };
    nextCursor: string | null;
    hasMore: boolean;
    startDate: string;
    endDate: string;
  }>(`/api/admin/reports/trial-balance${query ? `?${query}` : ''}`, { token });
}

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 5000;

export async function fetchAllReportWalletTransactions(
  token: string,
  params: { startDate?: string; endDate?: string },
): Promise<{ items: ReportWalletTransaction[]; truncated: boolean }> {
  const items: ReportWalletTransaction[] = [];
  let cursor: string | undefined;
  let truncated = false;

  while (items.length < EXPORT_MAX_ROWS) {
    const { transactions, nextCursor } = await fetchReportWalletTransactions(token, {
      ...params,
      cursor,
      limit: EXPORT_PAGE_SIZE,
    });
    items.push(...transactions);
    if (!nextCursor || items.length >= EXPORT_MAX_ROWS) {
      truncated = Boolean(nextCursor) || items.length > EXPORT_MAX_ROWS;
      break;
    }
    cursor = nextCursor;
  }

  return { items: items.slice(0, EXPORT_MAX_ROWS), truncated };
}

export async function fetchAllReportFundingOrders(
  token: string,
  params: { startDate?: string; endDate?: string },
): Promise<{ items: ReportFundingOrder[]; truncated: boolean }> {
  const items: ReportFundingOrder[] = [];
  let cursor: string | undefined;
  let truncated = false;

  while (items.length < EXPORT_MAX_ROWS) {
    const { orders, nextCursor } = await fetchReportFundingOrders(token, {
      ...params,
      cursor,
      limit: EXPORT_PAGE_SIZE,
    });
    items.push(...orders);
    if (!nextCursor || items.length >= EXPORT_MAX_ROWS) {
      truncated = Boolean(nextCursor) || items.length > EXPORT_MAX_ROWS;
      break;
    }
    cursor = nextCursor;
  }

  return { items: items.slice(0, EXPORT_MAX_ROWS), truncated };
}

export type ReportEmailNotification = {
  id: string;
  recipientEmail: string;
  template: 'OTP_SIGN_IN' | 'WELCOME' | 'CARD_READY';
  audience: 'CUSTOMER' | 'ADMIN';
  subject: string;
  body: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  resendMessageId: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    adminUser: boolean;
  } | null;
};

export function fetchReportEmailNotifications(
  token: string,
  params: {
    cursor?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
    template?: string;
    status?: string;
    email?: string;
  } = {},
) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.template) qs.set('template', params.template);
  if (params.status) qs.set('status', params.status);
  if (params.email) qs.set('email', params.email);
  const query = qs.toString();
  return request<{ notifications: ReportEmailNotification[]; nextCursor: string | null; limit: number }>(
    `/api/admin/reports/email-notifications${query ? `?${query}` : ''}`,
    { token },
  );
}

export async function fetchAllReportEmailNotifications(
  token: string,
  params: {
    startDate?: string;
    endDate?: string;
    template?: string;
    status?: string;
    email?: string;
  },
): Promise<{ items: ReportEmailNotification[]; truncated: boolean }> {
  const items: ReportEmailNotification[] = [];
  let cursor: string | undefined;
  let truncated = false;

  while (items.length < EXPORT_MAX_ROWS) {
    const { notifications, nextCursor } = await fetchReportEmailNotifications(token, {
      ...params,
      cursor,
      limit: EXPORT_PAGE_SIZE,
    });
    items.push(...notifications);
    if (!nextCursor || items.length >= EXPORT_MAX_ROWS) {
      truncated = Boolean(nextCursor) || items.length > EXPORT_MAX_ROWS;
      break;
    }
    cursor = nextCursor;
  }

  return { items: items.slice(0, EXPORT_MAX_ROWS), truncated };
}

export function updateCardStatus(
  token: string,
  userId: string,
  cardId: string,
  status: 'active' | 'inactive',
) {
  return request<{ card: AdminCardSummary }>(`/api/admin/users/${userId}/cards/${cardId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function fetchAdminPushConfig(token: string) {
  return request<{ enabled: boolean; publicKey: string }>('/api/admin/push/config', { token });
}

export function saveAdminPushSubscription(token: string, subscription: PushSubscriptionPayload) {
  return request<{ ok: boolean }>('/api/admin/push/subscribe', {
    method: 'POST',
    token,
    body: JSON.stringify(subscription),
  });
}

export function removeAdminPushSubscription(token: string, endpoint: string) {
  return request<{ ok: boolean }>('/api/admin/push/unsubscribe', {
    method: 'POST',
    token,
    body: JSON.stringify({ endpoint }),
  });
}

export type Permission = {
  id: string;
  moduleKey: string;
  actionKey: string;
  name: string;
  description: string | null;
};

export type PermissionsCatalog = {
  modules: string[];
  actions: string[];
  moduleActions: Record<string, string[]>;
  permissions: Permission[];
};

export type RoleSummary = {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  groupCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RoleDetail = RoleSummary & {
  permissionIds: string[];
  permissions: Permission[];
};

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  roleId: string;
  role: { id: string; name: string };
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type OperatorSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'ACTIVE' | 'DISABLED';
  totpEnrolled: boolean;
  createdAt: string;
  roles: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
};

export type OperatorCandidate = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  adminUserType: 'OWNER' | 'OPERATOR' | null;
};

export function fetchPermissionsCatalog(token: string) {
  return request<PermissionsCatalog>('/api/admin/roles/permissions', { token });
}

export function fetchRoles(token: string) {
  return request<RoleSummary[]>('/api/admin/roles', { token });
}

export function fetchRole(token: string, roleId: string) {
  return request<RoleDetail>(`/api/admin/roles/${roleId}`, { token });
}

export function createRole(token: string, data: { name: string; description?: string }) {
  return request<RoleSummary>('/api/admin/roles', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateRole(
  token: string,
  roleId: string,
  data: { name?: string; description?: string | null },
) {
  return request<RoleSummary>(`/api/admin/roles/${roleId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function setRolePermissions(token: string, roleId: string, permissionIds: string[]) {
  return request<{ id: string; permissionIds: string[] }>(
    `/api/admin/roles/${roleId}/permissions`,
    { method: 'PUT', token, body: JSON.stringify({ permissionIds }) },
  );
}

export function deleteRole(token: string, roleId: string) {
  return request<void>(`/api/admin/roles/${roleId}`, { method: 'DELETE', token });
}

export function fetchGroups(token: string) {
  return request<GroupSummary[]>('/api/admin/groups', { token });
}

export function createGroup(
  token: string,
  data: { name: string; description?: string; roleId: string },
) {
  return request<GroupSummary>('/api/admin/groups', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateGroup(
  token: string,
  groupId: string,
  data: { name?: string; description?: string | null; roleId?: string },
) {
  return request<GroupSummary>(`/api/admin/groups/${groupId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteGroup(token: string, groupId: string) {
  return request<void>(`/api/admin/groups/${groupId}`, { method: 'DELETE', token });
}

export type CatalogStatus = 'ACTIVE' | 'INACTIVE';
export type BusinessEntityType = 'VENDOR_INCOME';
export type BusinessAccountPurpose = 'FEE_INCOME' | 'FUND_HOLDING' | 'SETTLEMENT' | 'OTHER';
export type BusinessAccountTxnType = 'CREDIT' | 'DEBIT';
export type ServiceType = 'INTERNAL' | 'EXTERNAL' | 'INTERNATIONAL';
export type ServiceBehaviour = 'TRANSACTIONAL' | 'NON_TRANSACTIONAL';
export type DenominationUnitType = 'FLEX' | 'FIXED';
export type ProductUnitType = 'MONETARY' | 'NON_MONETARY';
export type UcpUnit = 'FEES' | 'REWARD' | 'SETTLEMENT' | 'TAX' | 'OTHER';
export type UcpType = 'FIXED' | 'SLAB';
export type UcpCalculationType = 'INCLUSIVE' | 'EXCLUSIVE';
export type UcpSlabValueType = 'PERCENT' | 'FIXED_AMOUNT';

export type ServiceSummary = {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  behaviour: ServiceBehaviour;
  status: CatalogStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductSummary = {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  serviceId: string;
  service: { id: string; name: string };
  denominationUnitType: DenominationUnitType;
  productUnitType: ProductUnitType;
  startDate: string | null;
  expiryDate: string | null;
  currency: string;
  status: CatalogStatus;
  fundHoldingAccountId: string | null;
  fundHoldingAccount: {
    id: string;
    code: string;
    name: string;
    purpose: BusinessAccountPurpose;
    currency: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type UcpSlabSummary = {
  id: string;
  minAmount: number;
  maxAmount: number | null;
  value: number;
  valueType: UcpSlabValueType;
  sortOrder: number;
};

export type UcpSlabInput = {
  minAmount: number;
  maxAmount?: number | null;
  value: number;
  valueType: UcpSlabValueType;
  sortOrder?: number;
};

export type UcpSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: UcpUnit;
  ucpType: UcpType;
  calculationType: UcpCalculationType;
  allowDebitOnSuccessfulTransaction: boolean;
  startDate: string | null;
  expiryDate: string | null;
  minValue: number | null;
  maxValue: number | null;
  fixedValue: number | null;
  status: CatalogStatus;
  slabs: UcpSlabSummary[];
  createdAt: string;
  updatedAt: string;
};

export function fetchServices(token: string) {
  return request<ServiceSummary[]>('/api/admin/services', { token });
}

export function createService(
  token: string,
  data: {
    name: string;
    description?: string;
    type: ServiceType;
    behaviour: ServiceBehaviour;
    status?: CatalogStatus;
  },
) {
  return request<ServiceSummary>('/api/admin/services', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateService(
  token: string,
  serviceId: string,
  data: {
    name?: string;
    description?: string | null;
    type?: ServiceType;
    behaviour?: ServiceBehaviour;
    status?: CatalogStatus;
  },
) {
  return request<ServiceSummary>(`/api/admin/services/${serviceId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteService(token: string, serviceId: string) {
  return request<void>(`/api/admin/services/${serviceId}`, { method: 'DELETE', token });
}

export function fetchProducts(token: string, serviceId?: string) {
  const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : '';
  return request<ProductSummary[]>(`/api/admin/products${query}`, { token });
}

export function createProduct(
  token: string,
  data: {
    code: string;
    name: string;
    displayName: string;
    description?: string;
    serviceId: string;
    denominationUnitType: DenominationUnitType;
    productUnitType: ProductUnitType;
    startDate?: string | null;
    expiryDate?: string | null;
    currency: string;
    status?: CatalogStatus;
    fundHoldingAccountId?: string | null;
  },
) {
  return request<ProductSummary>('/api/admin/products', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateProduct(
  token: string,
  productId: string,
  data: Partial<{
    code: string;
    name: string;
    displayName: string;
    description: string | null;
    serviceId: string;
    denominationUnitType: DenominationUnitType;
    productUnitType: ProductUnitType;
    startDate: string | null;
    expiryDate: string | null;
    currency: string;
    status: CatalogStatus;
    fundHoldingAccountId: string | null;
  }>,
) {
  return request<ProductSummary>(`/api/admin/products/${productId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteProduct(token: string, productId: string) {
  return request<void>(`/api/admin/products/${productId}`, { method: 'DELETE', token });
}

export function fetchUcps(token: string) {
  return request<UcpSummary[]>('/api/admin/ucps', { token });
}

export function createUcp(
  token: string,
  data: {
    code: string;
    name: string;
    description?: string;
    unit: UcpUnit;
    ucpType: UcpType;
    calculationType: UcpCalculationType;
    allowDebitOnSuccessfulTransaction?: boolean;
    startDate?: string | null;
    expiryDate?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    fixedValue?: number | null;
    status?: CatalogStatus;
    slabs?: UcpSlabInput[];
  },
) {
  return request<UcpSummary>('/api/admin/ucps', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateUcp(
  token: string,
  ucpId: string,
  data: Partial<{
    code: string;
    name: string;
    description: string | null;
    unit: UcpUnit;
    ucpType: UcpType;
    calculationType: UcpCalculationType;
    allowDebitOnSuccessfulTransaction: boolean;
    startDate: string | null;
    expiryDate: string | null;
    minValue: number | null;
    maxValue: number | null;
    fixedValue: number | null;
    status: CatalogStatus;
    slabs: UcpSlabInput[];
  }>,
) {
  return request<UcpSummary>(`/api/admin/ucps/${ucpId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteUcp(token: string, ucpId: string) {
  return request<void>(`/api/admin/ucps/${ucpId}`, { method: 'DELETE', token });
}

export type SettlementRequestSummary = {
  id: string;
  name: string;
  description: string | null;
  productId: string;
  ucpId: string;
  priority: number;
  startDate: string | null;
  expiryDate: string | null;
  status: CatalogStatus;
  feeDestinationAccountId: string | null;
  feeDestinationAccount: {
    id: string;
    code: string;
    name: string;
    purpose: BusinessAccountPurpose;
    currency: string;
  } | null;
  product: { id: string; code: string; name: string; displayName: string; currency: string };
  ucp: { id: string; code: string; name: string; unit: UcpUnit; ucpType: UcpType };
  createdAt: string;
  updatedAt: string;
};

export function fetchSettlementRequests(token: string, productId?: string) {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : '';
  return request<SettlementRequestSummary[]>(`/api/admin/settlement-requests${query}`, { token });
}

export function createSettlementRequest(
  token: string,
  data: {
    name: string;
    description?: string;
    productId: string;
    ucpId: string;
    priority?: number;
    startDate?: string | null;
    expiryDate?: string | null;
    status?: CatalogStatus;
    feeDestinationAccountId?: string | null;
  },
) {
  return request<SettlementRequestSummary>('/api/admin/settlement-requests', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateSettlementRequest(
  token: string,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    productId: string;
    ucpId: string;
    priority: number;
    startDate: string | null;
    expiryDate: string | null;
    status: CatalogStatus;
    feeDestinationAccountId: string | null;
  }>,
) {
  return request<SettlementRequestSummary>(`/api/admin/settlement-requests/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteSettlementRequest(token: string, id: string) {
  return request<void>(`/api/admin/settlement-requests/${id}`, { method: 'DELETE', token });
}

export type BusinessEntitySummary = {
  id: string;
  code: string;
  name: string;
  type: BusinessEntityType;
  description: string | null;
  status: CatalogStatus;
  accountCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessAccountSummary = {
  id: string;
  entityId: string;
  code: string;
  name: string;
  currency: string;
  purpose: BusinessAccountPurpose;
  balance: number;
  status: CatalogStatus;
  entity: { id: string; code: string; name: string; type: BusinessEntityType };
  createdAt: string;
  updatedAt: string;
};

export type BusinessAccountTransaction = {
  id: string;
  accountId: string;
  type: BusinessAccountTxnType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  productCode: string | null;
  ucpCode: string | null;
  description: string | null;
  createdAt: string;
};

export function fetchBusinessEntities(token: string) {
  return request<BusinessEntitySummary[]>('/api/admin/business-entities', { token });
}

export function createBusinessEntity(
  token: string,
  data: {
    code: string;
    name: string;
    type: BusinessEntityType;
    description?: string;
    status?: CatalogStatus;
  },
) {
  return request<BusinessEntitySummary>('/api/admin/business-entities', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateBusinessEntity(
  token: string,
  id: string,
  data: Partial<{
    code: string;
    name: string;
    type: BusinessEntityType;
    description: string | null;
    status: CatalogStatus;
  }>,
) {
  return request<BusinessEntitySummary>(`/api/admin/business-entities/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteBusinessEntity(token: string, id: string) {
  return request<void>(`/api/admin/business-entities/${id}`, { method: 'DELETE', token });
}

export function fetchBusinessAccounts(
  token: string,
  params?: { entityId?: string; purpose?: BusinessAccountPurpose },
) {
  const search = new URLSearchParams();
  if (params?.entityId) search.set('entityId', params.entityId);
  if (params?.purpose) search.set('purpose', params.purpose);
  const query = search.toString() ? `?${search.toString()}` : '';
  return request<BusinessAccountSummary[]>(`/api/admin/business-accounts${query}`, { token });
}

export function createBusinessAccount(
  token: string,
  data: {
    entityId: string;
    code: string;
    name: string;
    currency: string;
    purpose: BusinessAccountPurpose;
    status?: CatalogStatus;
  },
) {
  return request<BusinessAccountSummary>('/api/admin/business-accounts', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateBusinessAccount(
  token: string,
  id: string,
  data: Partial<{
    code: string;
    name: string;
    currency: string;
    purpose: BusinessAccountPurpose;
    status: CatalogStatus;
  }>,
) {
  return request<BusinessAccountSummary>(`/api/admin/business-accounts/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function deleteBusinessAccount(token: string, id: string) {
  return request<void>(`/api/admin/business-accounts/${id}`, { method: 'DELETE', token });
}

export function fetchBusinessAccountTransactions(
  token: string,
  accountId: string,
  params?: { cursor?: string; limit?: number; startDate?: string; endDate?: string },
) {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.startDate) search.set('startDate', params.startDate);
  if (params?.endDate) search.set('endDate', params.endDate);
  const query = search.toString() ? `?${search.toString()}` : '';
  return request<{
    items: BusinessAccountTransaction[];
    nextCursor: string | null;
    hasMore: boolean;
    startDate: string;
    endDate: string;
  }>(`/api/admin/business-accounts/${accountId}/transactions${query}`, { token });
}

export type ExchangeRateSnapshotRecord = {
  id: string;
  status: 'success' | 'failed';
  rate: number | null;
  baseCurrency: string;
  targetCurrency: string;
  requestedAt: string;
  respondedAt: string | null;
  sourceUpdatedAtUtc: string | null;
  httpStatus: number | null;
  catalogUpdated: boolean;
  previousRate: number | null;
  errorMessage: string | null;
};

export type ExchangeRateSnapshotsResponse = {
  summary: {
    latestRate: number | null;
    latestAt: string | null;
    baseCurrency: string;
    targetCurrency: string;
    minRate: number | null;
    maxRate: number | null;
    successCount: number;
    failureCount: number;
    pullCount: number;
  };
  points: Array<{
    id: string;
    requestedAt: string;
    rate: number;
    catalogUpdated: boolean;
    previousRate: number | null;
  }>;
};

export type ExchangeRatePullsResponse = {
  records: ExchangeRateSnapshotRecord[];
  nextCursor: string | null;
  limit: number;
};

export function fetchExchangeRateSnapshots(
  token: string,
  range: { startDate: string; endDate: string },
  options?: { chartLimit?: number },
) {
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  if (options?.chartLimit != null) params.set('chartLimit', String(options.chartLimit));
  return request<ExchangeRateSnapshotsResponse>(`/api/admin/exchange-rates/snapshots?${params}`, { token });
}

export function fetchExchangeRatePulls(
  token: string,
  range: { startDate: string; endDate: string },
  options?: { cursor?: string; limit?: number },
) {
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.limit != null) params.set('limit', String(options.limit));
  return request<ExchangeRatePullsResponse>(`/api/admin/exchange-rates/pulls?${params}`, { token });
}

export function fetchOperators(token: string) {
  return request<OperatorSummary[]>('/api/admin/operators', { token });
}

export function searchOperatorCandidates(token: string, q: string) {
  return request<{ users: OperatorCandidate[] }>(
    `/api/admin/operators/search?q=${encodeURIComponent(q)}`,
    { token },
  );
}

export function assignOperator(
  token: string,
  data: { userId?: string; email?: string; groupIds: string[] },
) {
  return request<OperatorSummary>('/api/admin/operators', {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export function updateOperator(
  token: string,
  operatorId: string,
  data: { groupIds?: string[]; status?: 'ACTIVE' | 'DISABLED' },
) {
  return request<OperatorSummary>(`/api/admin/operators/${operatorId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export function disableOperator(token: string, operatorId: string) {
  return request<OperatorSummary>(`/api/admin/operators/${operatorId}/disable`, {
    method: 'POST',
    token,
    body: '{}',
  });
}

export function enableOperator(token: string, operatorId: string) {
  return request<OperatorSummary>(`/api/admin/operators/${operatorId}/enable`, {
    method: 'POST',
    token,
    body: '{}',
  });
}

export function revokeOperator(token: string, operatorId: string) {
  return request<void>(`/api/admin/operators/${operatorId}`, { method: 'DELETE', token });
}

export type KycWorkflowSummaryRow = {
  adminUserId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  action: 'approved' | 'rejected';
  count: number;
  lastAt: string;
};

export type KycWorkflowSummary = {
  date: string;
  search: string | null;
  totals: { approved: number; rejected: number; total: number };
  rows: KycWorkflowSummaryRow[];
};

export type KycWorkflowAuditRecord = {
  id: string;
  action: 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  admin: {
    id: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

export function fetchKycWorkflowSummary(
  token: string,
  params: { date?: string; search?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.date) qs.set('date', params.date);
  if (params.search) qs.set('search', params.search);
  const query = qs.toString();
  return request<KycWorkflowSummary>(
    `/api/admin/workflow/kyc/summary${query ? `?${query}` : ''}`,
    { token },
  );
}

export function fetchKycWorkflowDetail(
  token: string,
  params: {
    date?: string;
    search?: string;
    action?: 'approved' | 'rejected';
    cursor?: string;
    limit?: number;
  } = {},
) {
  const qs = new URLSearchParams();
  if (params.date) qs.set('date', params.date);
  if (params.search) qs.set('search', params.search);
  if (params.action) qs.set('action', params.action);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<{ records: KycWorkflowAuditRecord[]; nextCursor: string | null; limit: number }>(
    `/api/admin/workflow/kyc/detail${query ? `?${query}` : ''}`,
    { token },
  );
}
