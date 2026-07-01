import {
  fetchAdminPushConfig,
  removeAdminPushSubscription,
  saveAdminPushSubscription,
} from './api';
import { getAdminToken } from './auth-storage';

const PUSH_PROMPT_KEY = 'vpay-admin-push-prompted';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isAdminPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function registerBrowserPushSubscription(token: string): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const { publicKey } = await fetchAdminPushConfig(token);
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return false;
  }

  await saveAdminPushSubscription(token, {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  });

  return true;
}

export async function ensureAdminPushSubscription(): Promise<boolean> {
  if (!isAdminPushSupported()) return false;

  const token = getAdminToken();
  if (!token) return false;

  try {
    const { enabled, publicKey } = await fetchAdminPushConfig(token);
    if (!enabled || !publicKey) return false;
  } catch {
    return false;
  }

  if (Notification.permission === 'denied') return false;

  if (Notification.permission === 'granted') {
    return registerBrowserPushSubscription(token);
  }

  const alreadyPrompted = localStorage.getItem(PUSH_PROMPT_KEY);
  if (alreadyPrompted) return false;

  localStorage.setItem(PUSH_PROMPT_KEY, '1');
  return registerBrowserPushSubscription(token);
}

export async function clearAdminPushSubscription(): Promise<void> {
  if (!isAdminPushSupported()) return;

  const token = getAdminToken();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  if (token) {
    try {
      await removeAdminPushSubscription(token, subscription.endpoint);
    } catch {
      // Best effort — still remove browser subscription below.
    }
  }

  await subscription.unsubscribe();
}
