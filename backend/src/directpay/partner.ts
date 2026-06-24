export type DirectPayPartnerConfig = {
  baseUrl: string;
  apiSecret: string;
  configured: boolean;
};

export function getDirectPayPartnerConfig(): DirectPayPartnerConfig {
  const baseUrl = (process.env.DIRECTPAY_API_BASE_URL || '').replace(/\/$/, '');
  const apiSecret = (process.env.INTERNAL_PARTNER_API_SECRET || '').trim();
  return {
    baseUrl,
    apiSecret,
    configured: Boolean(baseUrl && apiSecret),
  };
}

async function partnerJson<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { baseUrl, apiSecret, configured } = getDirectPayPartnerConfig();
  if (!configured) {
    throw Object.assign(new Error('directPay partner API is not configured'), {
      code: 'DIRECTPAY_NOT_CONFIGURED',
    });
  }
  const url = `${baseUrl}/api/internal-partner/v1${path.startsWith('/') ? path : `/${path}`}`;
  const method = init.method || 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiSecret}`,
    Accept: 'application/json',
  };
  let body: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const apiMessage =
      typeof json.error === 'string'
        ? json.error
        : typeof json.message === 'string'
          ? json.message
          : null;
    const err = new Error(
      apiMessage ?? `directPay ${method} ${path} failed: ${res.status}`,
    );
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { status?: number; body?: unknown }).body = json;
    throw err;
  }
  return json as T;
}

function extractWalletsPayload(json: Record<string, unknown>): unknown[] {
  const d = json?.data;
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'object' && d !== null) {
    const obj = d as Record<string, unknown>;
    if (Array.isArray(obj.wallets)) return obj.wallets;
    if (Array.isArray(obj.checkoutWallets)) return obj.checkoutWallets;
    if (Array.isArray(obj.gatewayWallets)) return obj.gatewayWallets;
    if (Array.isArray(obj.items)) return obj.items;
    const nested = obj.data;
    if (nested && typeof nested === 'object' && Array.isArray((nested as Record<string, unknown>).wallets)) {
      return (nested as Record<string, unknown>).wallets as unknown[];
    }
  }
  return [];
}

export type NormalizedCheckoutWallet = {
  gatewayId: string;
  code: string;
  name: string;
  checkoutAdapter: string;
  hasStoredPayerPhone: boolean;
};

function normalizeWalletRow(raw: unknown): NormalizedCheckoutWallet | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const gateway = row.gateway as Record<string, unknown> | undefined;
  const code = String(row.code ?? row.gatewayCode ?? gateway?.code ?? '').trim();
  if (!code) return null;
  const gatewayId = String(row.gatewayId ?? row.id ?? gateway?.id ?? code).trim() || code;
  const name = String(row.name ?? row.label ?? row.title ?? row.displayName ?? code).trim() || code;
  const checkoutAdapter = String(row.checkoutAdapter ?? row.adapter ?? row.type ?? '').trim();
  return {
    gatewayId,
    code,
    name,
    checkoutAdapter,
    hasStoredPayerPhone: Boolean(row.hasStoredPayerPhone),
  };
}

export async function provisionDirectPayTenant(input: {
  externalUserId: string;
  ownerEmail: string;
  ownerName: string;
  businessName: string;
  slug?: string;
  industry?: string;
  webhookUrl?: string | null;
}) {
  const json = await partnerJson<{
    data: {
      businessId: string;
      userId: string;
      subscriptionId: string;
      slug: string;
      idempotentReplay: boolean;
    };
  }>('/provision', {
    method: 'POST',
    body: { ...input, partnerApp: 'vpay' },
  });
  return json.data;
}

export async function createDirectPayOrder(
  businessId: string,
  input: {
    partnerExternalBookingId: string;
    amountGmd: number;
    currency?: string;
    category?: string;
  },
) {
  const json = await partnerJson<{ data?: { order?: Record<string, unknown> } }>(
    `/businesses/${encodeURIComponent(businessId)}/orders`,
    { method: 'POST', body: input },
  );
  const rawOrder = json?.data?.order ?? json?.data;
  if (!rawOrder || typeof rawOrder !== 'object') {
    throw new Error(`directPay create order: missing order in response`);
  }
  const ro = rawOrder as Record<string, unknown>;
  const idVal = ro.id ?? ro.orderId ?? ro.order_id;
  if (idVal == null || String(idVal).trim() === '') {
    throw new Error(`directPay create order: missing order id`);
  }
  return {
    ...ro,
    id: String(idVal),
    publicCode: String(ro.publicCode ?? ro.public_code ?? ''),
    status: String(ro.status ?? ''),
    total: Number(ro.total ?? 0),
    currency: String(ro.currency ?? 'GMD'),
  };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function findFirstLaunchableUrlInValue(value: unknown, depth = 0): string {
  if (depth > 8) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^https?:\/\//i.test(s) && s.length < 4096) return s;
    if (/^(wave|wv|intent|mailto):/i.test(s) && s.length < 4096) return s;
    return '';
  }
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstLaunchableUrlInValue(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const found = findFirstLaunchableUrlInValue(v, depth + 1);
    if (found) return found;
  }
  return '';
}

function normalizeWalletCheckoutFromPartnerResponse(json: unknown): {
  payment: Record<string, unknown>;
  qrPayload: string;
  launchUrl: string;
  paymentHtml: string | null;
  checkoutAdapter: string;
} {
  const j = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const data = j.data != null && typeof j.data === 'object' ? (j.data as Record<string, unknown>) : j;
  const root = data && typeof data === 'object' ? data : {};
  const paymentObj =
    root.payment && typeof root.payment === 'object'
      ? (root.payment as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const urlKeys = [
    'launchUrl',
    'launch_url',
    'checkoutUrl',
    'checkout_url',
    'redirectUrl',
    'redirect_url',
    'url',
    'paymentUrl',
    'payment_url',
    'deepLink',
    'deep_link',
    'mobileLaunchUrl',
    'mobile_launch_url',
    'waveUrl',
    'wave_url',
    'href',
    'link',
  ];
  let launchUrl = pickString(root, urlKeys) || pickString(paymentObj, urlKeys);
  const checkoutAdapter =
    pickString(root, ['checkoutAdapter', 'checkout_adapter', 'adapter']) ||
    pickString(paymentObj, ['checkoutAdapter', 'checkout_adapter', 'adapter']);
  const qrPayload =
    pickString(root, ['qrPayload', 'qr_payload', 'qr']) ||
    pickString(paymentObj, ['qrPayload', 'qr_payload', 'qr']);
  const paymentHtmlRaw =
    pickString(root, ['paymentHtml', 'payment_html']) ||
    pickString(paymentObj, ['paymentHtml', 'payment_html']) ||
    '';
  if (!launchUrl) {
    launchUrl =
      findFirstLaunchableUrlInValue(root) ||
      findFirstLaunchableUrlInValue(paymentObj) ||
      findFirstLaunchableUrlInValue(j);
  }
  if (!launchUrl) {
    throw Object.assign(new Error('directPay wallet checkout returned no launch URL'), {
      code: 'DIRECTPAY_NO_LAUNCH_URL' as const,
    });
  }
  return {
    payment: Object.keys(paymentObj).length ? paymentObj : root,
    qrPayload,
    launchUrl,
    paymentHtml: paymentHtmlRaw || null,
    checkoutAdapter,
  };
}

export async function listDirectPayWallets(
  businessId: string,
  orderId: string,
): Promise<NormalizedCheckoutWallet[]> {
  const path = `/businesses/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}/checkout-wallets`;
  const json = await partnerJson<Record<string, unknown>>(path, { method: 'GET' });
  const rawList = extractWalletsPayload(json);
  return rawList
    .map((w) => normalizeWalletRow(w))
    .filter((w): w is NormalizedCheckoutWallet => w != null);
}

export function directPayGatewayCodeNeedsPayerPhone(gatewayCode: string): boolean {
  return String(gatewayCode || '').toLowerCase().includes('yonna');
}

export async function startDirectPayWalletCheckout(
  businessId: string,
  orderId: string,
  body: { gatewayCode: string; payerPhone?: string; gatewayId?: string },
) {
  const rawPhone =
    body.payerPhone && String(body.payerPhone).trim() ? String(body.payerPhone).trim() : undefined;
  const phone =
    rawPhone && directPayGatewayCodeNeedsPayerPhone(body.gatewayCode) ? rawPhone : undefined;
  const gatewayId =
    body.gatewayId && String(body.gatewayId).trim() ? String(body.gatewayId).trim() : undefined;

  const path = `/businesses/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}/payments/wallet`;

  const camel: Record<string, string> = { gatewayCode: body.gatewayCode };
  if (phone) camel.payerPhone = phone;
  if (gatewayId) camel.gatewayId = gatewayId;

  const snake: Record<string, string> = { gateway_code: body.gatewayCode };
  if (phone) snake.payer_phone = phone;
  if (gatewayId) snake.gateway_id = gatewayId;

  const attempts = [camel, snake];
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const json = await partnerJson<unknown>(path, { method: 'POST', body: attempts[i] });
      return normalizeWalletCheckoutFromPartnerResponse(json);
    } catch (e: unknown) {
      lastErr = e;
      const st = (e as { status?: number })?.status;
      if (st === 500 && i < attempts.length - 1) continue;
      throw e;
    }
  }
  throw lastErr;
}

export async function authorizeDirectPayApsWallet(
  businessId: string,
  orderId: string,
  body: { gatewayCode: string; payerMobile: string },
) {
  const b = encodeURIComponent(businessId);
  const o = encodeURIComponent(orderId);
  const paths = [
    `/businesses/${b}/orders/${o}/payments/aps-wallet/authorize`,
    `/businesses/${b}/orders/${o}/aps-wallet/authorize`,
  ];
  let lastErr: unknown;
  for (let i = 0; i < paths.length; i++) {
    try {
      const json = await partnerJson<{ data?: Record<string, unknown> }>(paths[i], {
        method: 'POST',
        body,
      });
      const d = (json?.data ?? json) as Record<string, unknown>;
      return {
        authState: String(d?.authState ?? d?.auth_state ?? ''),
        requiresOtp: Boolean(d?.requiresOtp ?? d?.requires_otp),
        raw: d,
      };
    } catch (e: unknown) {
      lastErr = e;
      if ((e as { status?: number })?.status === 404 && i < paths.length - 1) continue;
      throw e;
    }
  }
  throw lastErr;
}

export async function completeDirectPayApsWallet(
  businessId: string,
  orderId: string,
  body: { gatewayCode: string; authState: string; otp?: string },
) {
  const b = encodeURIComponent(businessId);
  const o = encodeURIComponent(orderId);
  const paths = [
    `/businesses/${b}/orders/${o}/payments/aps-wallet/complete`,
    `/businesses/${b}/orders/${o}/aps-wallet/complete`,
  ];
  let lastErr: unknown;
  for (let i = 0; i < paths.length; i++) {
    try {
      const json = await partnerJson<{ data?: unknown }>(paths[i], { method: 'POST', body });
      return json?.data ?? json;
    } catch (e: unknown) {
      lastErr = e;
      if ((e as { status?: number })?.status === 404 && i < paths.length - 1) continue;
      throw e;
    }
  }
  throw lastErr;
}

export async function cancelDirectPayOrder(businessId: string, orderId: string) {
  const { baseUrl, apiSecret, configured } = getDirectPayPartnerConfig();
  if (!configured) return;
  const url = `${baseUrl}/api/internal-partner/v1/businesses/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiSecret}` },
  });
  if (res.status !== 204 && res.status !== 404) {
    const t = await res.text().catch(() => '');
    console.warn('[directpay] cancel order non-204', res.status, t?.slice(0, 300));
  }
}
