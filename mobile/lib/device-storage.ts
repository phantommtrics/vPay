import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'vpay_registered_device_id';

export async function getRegisteredDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

export async function setRegisteredDeviceId(deviceId: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
}

export async function clearRegisteredDeviceId(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
}
