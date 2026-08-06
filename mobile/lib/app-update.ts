import * as Application from 'expo-application';
import { Platform } from 'react-native';

export type AppUpdateConfig = {
  forceUpdate: boolean;
  minVersion: string | null;
  minIosVersion: string | null;
  minAndroidVersion: string | null;
  minIosBuild: number | null;
  minAndroidVersionCode: number | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
  message: string;
};

export type AppUpdateDecision = {
  /** Show the update bottom sheet. */
  updateRequired: boolean;
  /** Non-dismissible sheet (force or below minimum). */
  force: boolean;
  storeUrl: string | null;
  message: string;
};

/** Compare dotted version strings (e.g. 1.0.4). Returns -1 / 0 / 1. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .trim()
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const left = parse(a);
  const right = parse(b);
  const len = Math.max(left.length, right.length);

  for (let i = 0; i < len; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff < 0) return -1;
    if (diff > 0) return 1;
  }
  return 0;
}

function resolveMinVersion(config: AppUpdateConfig): string | null {
  if (Platform.OS === 'ios') {
    return config.minIosVersion ?? config.minVersion;
  }
  if (Platform.OS === 'android') {
    return config.minAndroidVersion ?? config.minVersion;
  }
  return config.minVersion;
}

function resolveMinBuild(config: AppUpdateConfig): number | null {
  if (Platform.OS === 'ios') return config.minIosBuild;
  if (Platform.OS === 'android') return config.minAndroidVersionCode;
  return null;
}

function resolveStoreUrl(config: AppUpdateConfig): string | null {
  if (Platform.OS === 'ios') return config.iosStoreUrl;
  if (Platform.OS === 'android') return config.androidStoreUrl;
  return config.iosStoreUrl ?? config.androidStoreUrl;
}

function parseBuildNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasVersionFloor(config: AppUpdateConfig): boolean {
  return (
    resolveMinVersion(config) != null || resolveMinBuild(config) != null
  );
}

function isOutdated(config: AppUpdateConfig): boolean {
  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const minVersion = resolveMinVersion(config);
  if (minVersion && compareVersions(currentVersion, minVersion) < 0) {
    return true;
  }

  const minBuild = resolveMinBuild(config);
  const currentBuild = parseBuildNumber(Application.nativeBuildVersion);
  if (minBuild != null && (currentBuild == null || currentBuild < minBuild)) {
    return true;
  }

  return false;
}

/**
 * Decide whether to show the update prompt.
 *
 * - Below APP_MIN_* version/build → prompt (forced).
 * - APP_FORCE_UPDATE with no floors → prompt everyone (forced).
 * - APP_FORCE_UPDATE with floors set → only outdated installs are prompted;
 *   users already on/above the minimum are not blocked.
 */
export function evaluateAppUpdate(config: AppUpdateConfig): AppUpdateDecision {
  const storeUrl = resolveStoreUrl(config);
  const message = config.message;
  const outdated = isOutdated(config);

  if (outdated) {
    return { updateRequired: true, force: true, storeUrl, message };
  }

  // Nuclear only when force is on and no APP_MIN_* floors exist.
  // With floors set, meeting them clears the sheet even if forceUpdate stays true.
  if (config.forceUpdate && !hasVersionFloor(config)) {
    return { updateRequired: true, force: true, storeUrl, message };
  }

  return { updateRequired: false, force: false, storeUrl, message };
}
