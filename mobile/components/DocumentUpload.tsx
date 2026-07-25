import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppLock } from '@/contexts/AppLockContext';
import { assetUrl } from '@/lib/api';
import { resolveImagePickerResult } from '@/lib/image-picker-result';
import {
  clearPendingKycPicker,
  markPendingKycPicker,
  type KycPickerSide,
} from '@/lib/kyc-picker-recovery';
import { colors, radius } from '@/constants/theme';

type DocumentUploadProps = {
  label: string;
  hint?: string;
  required?: boolean;
  value: string | null;
  disabled?: boolean;
  cameraFacing?: 'front' | 'back';
  primaryAction?: 'camera' | 'gallery';
  recoveryKey?: KycPickerSide;
  onUpload: (uri: string, mimeType?: string | null) => Promise<void>;
  onRemove?: () => void;
};

export function DocumentUpload({
  label,
  hint,
  required,
  value,
  disabled,
  cameraFacing = 'back',
  primaryAction = 'gallery',
  recoveryKey,
  onUpload,
  onRemove,
}: DocumentUploadProps) {
  const { runWithLockDeferred } = useAppLock();
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUri(null);
      return;
    }
    const remote = assetUrl(value);
    if (!remote) return;

    setPreviewUri((current) => {
      if (
        current &&
        (current.startsWith('file://') ||
          current.startsWith('ph://') ||
          current.startsWith('content://'))
      ) {
        return current;
      }
      return remote;
    });
  }, [value]);

  const pickImage = async (useCamera: boolean) => {
    if (disabled || loading) return;

    try {
      await runWithLockDeferred(async () => {
        const permission = useCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('Permission needed', 'Please allow access to continue.');
          return;
        }

        if (recoveryKey) {
          await markPendingKycPicker(recoveryKey);
        }

        const pickerResult = useCamera
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.85,
              allowsEditing: true,
              cameraType:
                cameraFacing === 'front'
                  ? ImagePicker.CameraType.front
                  : ImagePicker.CameraType.back,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.85,
              allowsEditing: true,
            });

        const resolved = await resolveImagePickerResult(pickerResult);
        if (!resolved) {
          await clearPendingKycPicker();
          return;
        }

        const asset = resolved.assets[0];
        setPreviewUri(asset.uri);
        setLoading(true);

        try {
          await onUpload(asset.uri, asset.mimeType);
          await clearPendingKycPicker();
        } catch (err) {
          setPreviewUri(value ? assetUrl(value) : null);
          await clearPendingKycPicker();
          Alert.alert(
            'Upload failed',
            err instanceof Error ? err.message : 'Could not upload image',
          );
        } finally {
          setLoading(false);
        }
      });
    } catch (err) {
      await clearPendingKycPicker();
      Alert.alert(
        'Could not open picker',
        err instanceof Error ? err.message : 'Something went wrong while selecting the image.',
      );
    }
  };

  const hasPreview = Boolean(previewUri);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {!required ? <Text style={styles.optional}>Optional</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {hasPreview ? (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri: previewUri! }}
            style={styles.preview}
            resizeMode="cover"
          />
          {loading ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator color={colors.white} size="large" />
            </View>
          ) : null}
          {!disabled && onRemove ? (
            <Pressable style={styles.removeButton} onPress={onRemove}>
              <X size={16} color={colors.white} />
            </Pressable>
          ) : null}
          {!disabled && !loading ? (
            <View style={styles.replaceRow}>
              <Pressable style={styles.replaceChip} onPress={() => pickImage(true)}>
                <Camera size={14} color={colors.gray700} />
                <Text style={styles.replaceChipText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.replaceChip} onPress={() => pickImage(false)}>
                <ImagePlus size={14} color={colors.gray700} />
                <Text style={styles.replaceChipText}>Gallery</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.uploadBox, disabled && styles.uploadDisabled]}>
          <Pressable
            style={styles.uploadMain}
            onPress={() => pickImage(primaryAction === 'camera')}
            disabled={disabled || loading}>
            {loading ? (
              <ActivityIndicator color={colors.emerald600} />
            ) : (
              <>
                <View style={styles.uploadIcon}>
                  {primaryAction === 'camera' ? (
                    <Camera size={24} color={colors.emerald600} />
                  ) : (
                    <ImagePlus size={24} color={colors.emerald600} />
                  )}
                </View>
                <Text style={styles.uploadTitle}>
                  {primaryAction === 'camera'
                    ? 'Tap to take a photo with your camera'
                    : 'Tap to choose from gallery'}
                </Text>
              </>
            )}
          </Pressable>

          {!loading ? (
            <View style={styles.uploadActions}>
              <Pressable
                style={styles.uploadChip}
                onPress={() => pickImage(true)}
                disabled={disabled}>
                <Camera size={14} color={colors.gray600} />
                <Text style={styles.uploadChipText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.uploadChip}
                onPress={() => pickImage(false)}
                disabled={disabled}>
                <ImagePlus size={14} color={colors.gray600} />
                <Text style={styles.uploadChipText}>Gallery</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    fontFamily: 'Inter_600SemiBold',
  },
  required: {
    color: colors.red500,
  },
  optional: {
    fontSize: 12,
    color: colors.gray400,
    fontFamily: 'Inter_400Regular',
  },
  hint: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: 'Inter_400Regular',
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: colors.gray200,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: colors.gray50,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 14,
  },
  uploadDisabled: {
    opacity: 0.6,
  },
  uploadMain: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 8,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.emerald50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray800,
    fontFamily: 'Inter_600SemiBold',
  },
  uploadActions: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  uploadChipText: {
    fontSize: 13,
    color: colors.gray600,
    fontFamily: 'Inter_500Medium',
  },
  previewWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray100,
  },
  preview: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray100,
  },
  previewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  replaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gray50,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  replaceChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray700,
    fontFamily: 'Inter_500Medium',
  },
});
