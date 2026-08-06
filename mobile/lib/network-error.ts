import { API_URL } from './config';

export function getApiHostLabel(): string {
  if (!API_URL) {
    return 'the server';
  }

  try {
    return new URL(API_URL).host;
  } catch {
    return 'the server';
  }
}

export function toNetworkErrorMessage(error: unknown): string {
  if (!API_URL) {
    return 'App API URL is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env and restart Expo with cache clear.';
  }

  const host = getApiHostLabel();
  const detail = error instanceof Error ? error.message : String(error);

  if (
    /could not be resolved|couldn't be resolved|not be resolved|ENOTFOUND|Unable to resolve host|getaddrinfo|NSURLErrorDomain.*-1003|A server with the specified hostname could not be found|Unable to fetch data/i.test(
      detail,
    )
  ) {
    return `Cannot reach ${host}. Check your internet connection, disable VPN or ad blockers, and try another network if needed.`;
  }

  if (/SSL|certificate|CERT|handshake|TLS/i.test(detail)) {
    return `Secure connection to ${host} failed. Try again later or contact support.`;
  }

  return `Unable to reach ${host}. Check your internet connection and try again.`;
}
