import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/secure-storage';

const DEVICE_ID_KEY = 'vpay_registered_device_id';

export async function getRegisteredDeviceId(): Promise<string | null> {
  return getSecureItem(DEVICE_ID_KEY);
}

export async function setRegisteredDeviceId(deviceId: string): Promise<void> {
  await setSecureItem(DEVICE_ID_KEY, deviceId);
}

export async function clearRegisteredDeviceId(): Promise<void> {
  await deleteSecureItem(DEVICE_ID_KEY);
}
