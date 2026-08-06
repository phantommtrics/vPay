function parseEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function parseEnvNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseEnvString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type AppUpdateConfig = {
  /**
   * When true with no APP_MIN_* floors: prompt every client (nuclear).
   * When true with floors set: only outdated clients are prompted; installs
   * already on/above the minimum are not blocked.
   */
  forceUpdate: boolean;
  /** Minimum marketing version (semver), both platforms unless overridden. */
  minVersion: string | null;
  minIosVersion: string | null;
  minAndroidVersion: string | null;
  /** Minimum iOS CFBundleVersion / nativeBuildVersion. */
  minIosBuild: number | null;
  /** Minimum Android versionCode. */
  minAndroidVersionCode: number | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
  message: string;
};

const DEFAULT_MESSAGE = 'Please update vPay to continue.';

export function getAppUpdateConfig(): AppUpdateConfig {
  return {
    forceUpdate: parseEnvBoolean(process.env.APP_FORCE_UPDATE, false),
    minVersion: parseEnvString(process.env.APP_MIN_VERSION),
    minIosVersion: parseEnvString(process.env.APP_MIN_IOS_VERSION),
    minAndroidVersion: parseEnvString(process.env.APP_MIN_ANDROID_VERSION),
    minIosBuild: parseEnvNumber(process.env.APP_MIN_IOS_BUILD),
    minAndroidVersionCode: parseEnvNumber(process.env.APP_MIN_ANDROID_VERSION_CODE),
    iosStoreUrl: parseEnvString(process.env.APP_IOS_STORE_URL),
    androidStoreUrl: parseEnvString(process.env.APP_ANDROID_STORE_URL),
    message: parseEnvString(process.env.APP_UPDATE_MESSAGE) ?? DEFAULT_MESSAGE,
  };
}
