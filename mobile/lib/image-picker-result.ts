import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

function isPickerError(
  result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult,
): result is ImagePicker.ImagePickerErrorResult {
  return 'code' in result;
}

function hasSelectedAsset(
  result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
): result is ImagePicker.ImagePickerSuccessResult {
  return Boolean(result && !isPickerError(result) && !result.canceled && result.assets[0]);
}

export async function resolveImagePickerResult(
  result: ImagePicker.ImagePickerResult,
): Promise<ImagePicker.ImagePickerSuccessResult | null> {
  if (hasSelectedAsset(result)) {
    return result;
  }

  if (Platform.OS !== 'android') {
    return null;
  }

  const pending = await ImagePicker.getPendingResultAsync();
  if (hasSelectedAsset(pending)) {
    return pending;
  }

  return null;
}
