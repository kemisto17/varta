import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import { requestImageLibraryAccess } from '../../lib/imagePicker';
import { MAX_POST_IMAGE_SIZE } from '../../lib/posts';
import { ImageCropperModal } from './ImageCropperModal';

type PostImageFieldProps = {
  asset: ImagePickerAsset | null;
  disabled?: boolean;
  existingImageUrl?: string | null;
  onChange: (asset: ImagePickerAsset | null) => void;
  onError: (message: string | null) => void;
};

export function PostImageField({
  asset,
  disabled = false,
  existingImageUrl = null,
  onChange,
  onError,
}: PostImageFieldProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [cropCandidate, setCropCandidate] =
    useState<ImagePickerAsset | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const displayUri = asset?.uri ?? existingImageUrl;

  const pickImage = async () => {
    if (isPicking || disabled) {
      return;
    }

    setIsPicking(true);
    onError(null);

    try {
      if (!(await requestImageLibraryAccess())) {
        onError('Allow photo access to add an image to your post.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const nextAsset = result.assets[0];

      if (nextAsset.fileSize && nextAsset.fileSize > MAX_POST_IMAGE_SIZE) {
        onError('Choose an image smaller than 8 MB.');
        return;
      }

      setCropCandidate(nextAsset);
    } catch (error) {
      console.warn('[post-image] Could not open photo library.', error);
      onError('We could not open your photo library. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <>
      {displayUri ? (
        <View style={styles.imageContainer}>
          <Image
            accessibilityLabel="Selected post photo"
            contentFit="contain"
            source={{ uri: displayUri }}
            style={styles.imagePreview}
          />

          <Pressable
            accessibilityLabel="Remove selected photo"
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onChange(null)}
            style={({ pressed }) => [
              styles.removeImageButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{ android: 'close', ios: 'xmark', web: 'close' }}
              size={18}
              tintColor={colors.viewerForeground}
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={isPicking || disabled}
          onPress={() => void pickImage()}
          style={({ pressed }) => [
            styles.mediaButton,
            pressed && styles.pressed,
          ]}
        >
          {isPicking ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <SymbolView
              name={{ android: 'image', ios: 'photo', web: 'image' }}
              size={21}
              tintColor={colors.textPrimary}
            />
          )}

          <Text style={styles.mediaButtonText}>
            {displayUri ? 'Change photo' : 'Add photo'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.mediaHint}>
        Crop as original, 1:1, 4:5, or 16:9 · up to 8 MB
      </Text>

      <ImageCropperModal
        asset={cropCandidate}
        onCancel={() => setCropCandidate(null)}
        onCropped={(croppedAsset) => {
          onChange(croppedAsset);
          setCropCandidate(null);
        }}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    imageContainer: {
      overflow: 'hidden',
      marginTop: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.borderSubtle,
    },
    imagePreview: {
      width: '100%',
      aspectRatio: 4 / 3,
    },
    removeImageButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.imageOverlay,
    },
    footer: {
      marginTop: spacing.xl,
      flexDirection: 'row',
    },
    mediaButton: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
    },
    mediaButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    mediaHint: {
      marginTop: spacing.sm,
      fontSize: 11,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.58,
    },
  });
