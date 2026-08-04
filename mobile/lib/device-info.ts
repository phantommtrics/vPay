import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const FINGERPRINT_KEY = 'vpay_device_fingerprint';

const DEVICE_FIELD_LIMITS = {
  fingerprint: 128,
  deviceName: 200,
  brand: 100,
  manufacturer: 100,
  modelName: 100,
  deviceType: 100,
  osName: 100,
  osVersion: 100,
  imei: 100,
  hardwareId: 128,
  appVersion: 100,
} as const;

export type DeviceInfoPayload = {
  fingerprint: string;
  deviceName: string | null;
  brand: string | null;
  manufacturer: string | null;
  modelName: string | null;
  deviceType: string | null;
  osName: string | null;
  osVersion: string | null;
  imei: string | null;
  hardwareId: string | null;
  isEmulator: boolean;
  appVersion: string | null;
};

const DEVICE_TYPE_LABELS: Record<number, string> = {
  0: 'unknown',
  1: 'phone',
  2: 'tablet',
  3: 'desktop',
  4: 'tv',
};

function truncate(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function createFingerprint(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getOrCreateDeviceFingerprint(): Promise<string> {
  const existing = await SecureStore.getItemAsync(FINGERPRINT_KEY);
  if (existing) {
    return truncate(existing, DEVICE_FIELD_LIMITS.fingerprint) ?? existing.slice(0, DEVICE_FIELD_LIMITS.fingerprint);
  }

  const fingerprint = createFingerprint();
  await SecureStore.setItemAsync(FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

async function getHardwareId(): Promise<string | null> {
  if (Platform.OS === 'android') {
    return Application.getAndroidId();
  }
  if (Platform.OS === 'ios') {
    return Application.getIosIdForVendorAsync();
  }
  return null;
}

function getDeviceTypeLabel(): string | null {
  if (Device.deviceType == null) {
    return null;
  }

  return DEVICE_TYPE_LABELS[Device.deviceType] ?? 'unknown';
}

export function sanitizeDeviceInfo(payload: DeviceInfoPayload): DeviceInfoPayload {
  return {
    fingerprint:
      truncate(payload.fingerprint, DEVICE_FIELD_LIMITS.fingerprint) ?? payload.fingerprint.slice(0, DEVICE_FIELD_LIMITS.fingerprint),
    deviceName: truncate(payload.deviceName, DEVICE_FIELD_LIMITS.deviceName),
    brand: truncate(payload.brand, DEVICE_FIELD_LIMITS.brand),
    manufacturer: truncate(payload.manufacturer, DEVICE_FIELD_LIMITS.manufacturer),
    modelName: truncate(payload.modelName, DEVICE_FIELD_LIMITS.modelName),
    deviceType: truncate(payload.deviceType, DEVICE_FIELD_LIMITS.deviceType),
    osName: truncate(payload.osName, DEVICE_FIELD_LIMITS.osName),
    osVersion: truncate(payload.osVersion, DEVICE_FIELD_LIMITS.osVersion),
    imei: truncate(payload.imei, DEVICE_FIELD_LIMITS.imei),
    hardwareId: truncate(payload.hardwareId, DEVICE_FIELD_LIMITS.hardwareId),
    isEmulator: payload.isEmulator,
    appVersion: truncate(payload.appVersion, DEVICE_FIELD_LIMITS.appVersion),
  };
}

export async function collectDeviceInfo(): Promise<DeviceInfoPayload> {
  const [fingerprint, hardwareId] = await Promise.all([
    getOrCreateDeviceFingerprint(),
    getHardwareId(),
  ]);

  return sanitizeDeviceInfo({
    fingerprint,
    deviceName: Device.deviceName,
    brand: Device.brand,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    deviceType: getDeviceTypeLabel(),
    osName: Device.osName,
    osVersion: Device.osVersion,
    // True IMEI is not available through public mobile APIs on iOS or modern Android.
    imei: null,
    hardwareId,
    isEmulator: Device.isDevice === false,
    appVersion: Application.nativeApplicationVersion,
  });
}
