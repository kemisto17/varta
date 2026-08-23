import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import {
  getPostErrorMessage,
  MAX_POST_CHARACTERS,
  MAX_POST_IMAGE_SIZE,
  publishPost,
} from '../../lib/posts';
import { getInitials } from '../../lib/text';

export default function CreateScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const [content, setContent] = useState('');
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const remainingCharacters = MAX_POST_CHARACTERS - content.length;
  const hasPostContent = content.trim().length > 0 || imageAsset !== null;
  const canPublish = hasPostContent && !isPublishing;

  const pickImage = async () => {
    if (isPicking || isPublishing) {
      return;
    }

    setIsPicking(true);
    setErrorMessage(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorMessage('Allow photo access to add an image to your post.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        mediaTypes: ['images'],
        quality: 0.78,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const nextAsset = result.assets[0];

      if (nextAsset.fileSize && nextAsset.fileSize > MAX_POST_IMAGE_SIZE) {
        setErrorMessage('Choose an image smaller than 8 MB.');
        return;
      }

      setImageAsset(nextAsset);
    } catch {
      setErrorMessage('We could not open your photo library. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const handlePublish = async () => {
    const userId = session?.user.id;

    if (!canPublish || !userId) {
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);

    try {
      await publishPost({
        asset: imageAsset,
        content,
        userId,
      });
      setContent('');
      setImageAsset(null);
      router.replace('/');
    } catch (error) {
      console.warn('[create-post] Publish failed.', error);
      setErrorMessage(getPostErrorMessage(error));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>New post</Text>

            <Pressable
              accessibilityRole="button"
              disabled={!canPublish}
              onPress={() => void handlePublish()}
              style={({ pressed }) => [
                styles.publishButton,
                !canPublish && styles.publishButtonDisabled,
                pressed && canPublish && styles.pressed,
              ]}
            >
              {isPublishing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text
                  style={[
                    styles.publishText,
                    !canPublish && styles.publishTextDisabled,
                  ]}
                >
                  Publish
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(profile?.full_name ?? 'Student')}
              </Text>
            </View>

            <View style={styles.authorCopy}>
              <Text numberOfLines={1} style={styles.authorName}>
                {profile?.full_name ?? 'Student'}
              </Text>
              <Text numberOfLines={1} style={styles.authorMeta}>
                {profile ? `${profile.branch} · ${formatYear(profile.year)}` : 'Campus member'}
              </Text>
            </View>
          </View>

          <TextInput
            editable={!isPublishing}
            maxLength={MAX_POST_CHARACTERS}
            multiline
            onChangeText={setContent}
            placeholder="What's happening on campus?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlignVertical="top"
            value={content}
          />

          {imageAsset ? (
            <View style={styles.imageContainer}>
              <Image
                accessibilityLabel="Selected post photo"
                resizeMode="cover"
                source={{ uri: imageAsset.uri }}
                style={styles.imagePreview}
              />

              <Pressable
                accessibilityLabel="Remove selected photo"
                accessibilityRole="button"
                disabled={isPublishing}
                onPress={() => setImageAsset(null)}
                style={({ pressed }) => [
                  styles.removeImageButton,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView
                  name={{ android: 'close', ios: 'xmark', web: 'close' }}
                  size={18}
                  tintColor={colors.white}
                />
              </Pressable>
            </View>
          ) : null}

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={isPicking || isPublishing}
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
                {imageAsset ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>

            <Text
              style={[
                styles.characterCount,
                remainingCharacters < 50 && styles.characterCountWarning,
              ]}
            >
              {remainingCharacters}
            </Text>
          </View>

          <Text style={styles.mediaHint}>
            JPG, PNG, WebP, HEIC, or HEIF · up to 8 MB
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatYear(year: number) {
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';

  return `${year}${suffix} year`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  publishButton: {
    minWidth: 88,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  publishButtonDisabled: {
    backgroundColor: colors.border,
  },

  publishText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  publishTextDisabled: {
    color: colors.textMuted,
  },

  authorRow: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: spacing.md,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  authorCopy: {
    flex: 1,
  },

  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  authorMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },

  input: {
    minHeight: 180,
    marginTop: spacing.xl,
    padding: 0,
    fontSize: 20,
    lineHeight: 29,
    color: colors.textPrimary,
  },

  imageContainer: {
    position: 'relative',
    width: '100%',
    marginTop: spacing.lg,
    aspectRatio: 4 / 3,
  },

  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.borderSubtle,
  },

  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },

  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  mediaButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  mediaButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  characterCount: {
    fontSize: 12,
    color: colors.textMuted,
  },

  characterCountWarning: {
    color: colors.textSecondary,
    fontWeight: '600',
  },

  mediaHint: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textMuted,
  },

  pressed: {
    opacity: 0.55,
  },
});
