import webpush from 'web-push';

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
      process.env.WEB_PUSH_VAPID_SUBJECT,
  );
}

export function getWebPushPublicKey(): string | null {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? null;
}

export function configureWebPush(): void {
  if (!isWebPushConfigured()) return;

  webpush.setVapidDetails(
    process.env.WEB_PUSH_VAPID_SUBJECT!,
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY!,
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY!,
  );
}

export function adminAppOrigin(): string {
  const configured = process.env.ADMIN_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const corsOrigin = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .find((origin) => origin.startsWith('http'));
  return corsOrigin ?? 'http://localhost:5173';
}

export { webpush };
