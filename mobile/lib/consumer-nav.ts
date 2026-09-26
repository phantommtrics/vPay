import { router, type Href } from 'expo-router';

export type PanelName =
  | 'personal-details'
  | 'security'
  | 'help-support'
  | 'my-tickets'
  | 'send-request'
  | 'terms'
  | 'privacy'
  | 'delete-account'
  | 'verify-credential'
  | 'set-pin'
  | 'set-password'
  | 'confirm-pin'
  | 'confirm-password'
  | 'ticket';

export type PanelEntry = {
  name: PanelName;
  params: Record<string, string>;
};

type ShellApi = {
  pushPanel: (entry: PanelEntry) => void;
  replacePanel: (entry: PanelEntry) => void;
  popPanel: () => void;
  closePanel: () => void;
  resetTo: (entry: PanelEntry) => void;
  hasPanel: () => boolean;
};

const PANEL_NAMES = new Set<string>([
  'personal-details',
  'security',
  'help-support',
  'my-tickets',
  'send-request',
  'terms',
  'privacy',
  'delete-account',
  'verify-credential',
  'set-pin',
  'set-password',
  'confirm-pin',
  'confirm-password',
]);

const TAB_PATHS = new Set([
  '',
  'fund',
  'cards',
  'transactions',
  'profile',
  '(tabs)',
  '(tabs)/index',
  '(tabs)/fund',
  '(tabs)/cards',
  '(tabs)/transactions',
  '(tabs)/profile',
]);

let api: ShellApi | null = null;
let shellActive = false;

export function registerConsumerShell(next: ShellApi | null, active: boolean) {
  api = next;
  shellActive = Boolean(active && next);
}

export function isDesktopShellActive() {
  return shellActive;
}

function asParams(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const params: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') params[key] = raw;
    else if (Array.isArray(raw) && typeof raw[0] === 'string') params[key] = raw[0];
    else if (typeof raw === 'number') params[key] = String(raw);
  }
  return params;
}

function parseHref(href: Href): { path: string; params: Record<string, string> } {
  if (typeof href === 'string') {
    const [pathPart, query] = href.split('?');
    const params: Record<string, string> = {};
    if (query) {
      const search = new URLSearchParams(query);
      search.forEach((value, key) => {
        params[key] = value;
      });
    }
    return { path: pathPart, params };
  }
  if (typeof href === 'object' && href && 'pathname' in href) {
    return {
      path: String(href.pathname),
      params: asParams('params' in href ? href.params : undefined),
    };
  }
  return { path: '', params: {} };
}

function normalizePath(path: string): string {
  return path.replace(/^\//, '').replace(/\/$/, '');
}

export function toPanel(href: Href): PanelEntry | null {
  const { path, params } = parseHref(href);
  const normalized = normalizePath(path);
  const ticketMatch = normalized.match(/^(?:\(tabs\)\/)?ticket\/([^/]+)$/);
  if (ticketMatch) {
    return { name: 'ticket', params: { ...params, id: decodeURIComponent(ticketMatch[1]) } };
  }
  if (normalized === 'ticket/[id]' || normalized === 'ticket') {
    return { name: 'ticket', params };
  }
  if (PANEL_NAMES.has(normalized)) {
    return { name: normalized as PanelName, params };
  }
  return null;
}

export function pushRoute(href: Href) {
  if (shellActive && api) {
    const panel = toPanel(href);
    if (panel) {
      api.pushPanel(panel);
      return;
    }
    const { path } = parseHref(href);
    if (TAB_PATHS.has(normalizePath(path))) {
      api.closePanel();
      return;
    }
  }
  router.push(href);
}

export function replaceRoute(href: Href) {
  if (shellActive && api) {
    const panel = toPanel(href);
    if (panel) {
      api.replacePanel(panel);
      return;
    }
  }
  router.replace(href);
}

export function goBack() {
  if (shellActive && api?.hasPanel()) {
    api.popPanel();
    return;
  }
  if (router.canGoBack()) {
    router.back();
  }
}

export function returnToSecurity() {
  if (shellActive && api) {
    api.resetTo({ name: 'security', params: {} });
    return;
  }
  if (router.canDismiss()) {
    router.dismissTo('/security');
    return;
  }
  router.replace('/security');
}
