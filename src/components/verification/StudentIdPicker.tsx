import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { MAX_VERIFICATION_FILE_SIZE } from '../../lib/verification';

type StudentIdPickerProps = {
  asset: ImagePickerAsset | null;
  onChange: (asset: ImagePickerAsset | null) => void;
  onError: (message: string | null) => void;
};

export function StudentIdPicker({
  asset,
  onChange,
  onError,
}: StudentIdPickerProps) {
  const [isPicking, setIsPicking] = useState(false);

  const handlePick = async () => {
    setIsPicking(true);
    onError(null);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        onError('Allow photo access to choose your college ID image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        mediaTypes: ['images'],
        quality: 0.85,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const nextAsset = result.assets[0];

      if (nextAsset.fileSize && nextAsset.fileSize > MAX_VERIFICATION_FILE_SIZE) {
        onError('Choose an image smaller than 5 MB.');
        return;
      }

      onChange(nextAsset);
    } catch {
      onError('We could not open your photo library. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  if (asset) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>College/student ID</Text>

        <View style={styles.selectedCard}>
          <Image
            accessibilityLabel="Selected student ID"
            resizeMode="cover"
            source={{ uri: asset.uri }}
            style={styles.preview}
          />

          <View style={styles.selectedCopy}>
            <Text style={styles.selectedEyebrow}>IMAGE SELECTED</Text>
            <Text style={styles.selectedTitle}>Student ID ready</Text>
            <Text style={styles.selectedMeta}>
              {asset.fileSize ? formatFileSize(asset.fileSize) : 'Image ready to upload'}
            </Text>

            <View style={styles.selectedActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handlePick}
                style={({ pressed }) => pressed && styles.actionPressed}
              >
                <Text style={styles.changeLabel}>Choose another</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => onChange(null)}
                style={({ pressed }) => pressed && styles.actionPressed}
              >
                <Text style={styles.removeLabel}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>College/student ID</Text>

      <Pressable
        accessibilityRole="button"
        disabled={isPicking}
        onPress={handlePick}
        style={({ pressed }) => [
          styles.emptyCard,
          pressed && !isPicking && styles.emptyCardPressed,
        ]}
      >
        <View style={styles.uploadMark}>
          {isPicking ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.uploadIcon}>＋</Text>
          )}
        </View>
        <Text style={styles.emptyTitle}>
          {isPicking ? 'Opening your library…' : 'Choose your student ID'}
        </Text>
        <Text style={styles.emptySubtitle}>
          JPG, PNG, WebP, HEIC, or HEIF · up to 5 MB
        </Text>
      </Pressable>
    </View>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  emptyCard: {
    minHeight: 184,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  emptyCardPressed: {
    borderColor: colors.textSecondary,
    backgroundColor: colors.borderSubtle,
  },

  uploadMark: {
    width: 46,
    height: 46,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  uploadIcon: {
    fontSize: 25,
    lineHeight: 27,
    fontWeight: '300',
    color: colors.textPrimary,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  emptySubtitle: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },

  selectedCard: {
    minHeight: 142,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },

  preview: {
    width: 116,
    minHeight: 124,
    borderRadius: radius.md,
    backgroundColor: colors.borderSubtle,
  },

  selectedCopy: {
    flex: 1,
    padding: spacing.md,
  },

  selectedEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.success,
  },

  selectedTitle: {
    marginTop: spacing.xs,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  selectedMeta: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },

  selectedActions: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: spacing.md,
  },

  changeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  removeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },

  actionPressed: {
    opacity: 0.5,
  },
});
