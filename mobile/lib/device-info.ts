import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const FINGERPRINT_KEY = 'vpay_device_fingerprint';

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
    return existing;
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

export async function collectDeviceInfo(): Promise<DeviceInfoPayload> {
  const [fingerprint, hardwareId] = await Promise.all([
    getOrCreateDeviceFingerprint(),
    getHardwareId(),
  ]);

  return {
    fingerprint,
    deviceName: Device.deviceName,
    brand: Device.brand,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    deviceType: Device.deviceType != null ? String(Device.deviceType) : null,
    osName: Device.osName,
    osVersion: Device.osVersion,
    // True IMEI is not available through public mobile APIs on iOS or modern Android.
    imei: null,
    hardwareId,
    isEmulator: Device.isDevice === false,
    appVersion: Application.nativeApplicationVersion,
  };
}
