import * as SecureStore from 'expo-secure-store';

const PENDING_KYC_PICKER_KEY = 'vpay_pending_kyc_picker';

export type KycPickerSide = 'front' | 'back' | 'selfie';

export async function markPendingKycPicker(side: KycPickerSide): Promise<void> {
  await SecureStore.setItemAsync(PENDING_KYC_PICKER_KEY, side);
}

export async function getPendingKycPicker(): Promise<KycPickerSide | null> {
  const side = await SecureStore.getItemAsync(PENDING_KYC_PICKER_KEY);
  if (side === 'front' || side === 'back' || side === 'selfie') {
    return side;
  }
  return null;
}

export async function clearPendingKycPicker(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_KYC_PICKER_KEY);
}
