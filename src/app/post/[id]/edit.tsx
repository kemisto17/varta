import type { ImagePickerAsset } from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { PostImageField } from '../../../components/posts/PostImageField';
import { radius, spacing, type ThemeColors } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useFeed } from '../../../hooks/useFeed';
import { useThemedStyles } from '../../../hooks/useTheme';
import { isUuid } from '../../../lib/identifiers';
import {
  getPostById,
  getPostErrorMessage,
  MAX_LOST_FOUND_LOCATION_CHARACTERS,
  MAX_POST_CHARACTERS,
  updatePost,
} from '../../../lib/posts';
import type { FeedPost, PostKind } from '../../../types/post';

export default function EditPostScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const postId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const { replacePost } = useFeed();
  const savePendingRef = useRef(false);

  const [post, setPost] = useState<FeedPost | null>(null);
  const [content, setContent] = useState('');
  const [postKind, setPostKind] = useState<PostKind>('general');
  const [location, setLocation] = useState('');
  const [isResolved, setIsResolved] = useState(false);
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [isExistingImageRemoved, setIsExistingImageRemoved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;
    const userId = session?.user.id;

    if (!isUuid(postId) || !userId) {
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    void getPostById(postId, userId)
      .then((result) => {
        if (!isActive || !result?.canEditByCurrentUser) {
          return;
        }

        setPost(result);
        setContent(result.content);
        setPostKind(result.postKind);
        setLocation(result.lostFoundLocation ?? '');
        setIsResolved(result.lostFoundResolvedAt !== null);
      })
      .catch((error) => {
        console.warn('[edit-post] Could not load post.', error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [postId, session?.user.id]);

  const hasImage =
    imageAsset !== null ||
    (post?.imagePath !== null && !isExistingImageRemoved);
  const hasRequiredContent =
    postKind === 'general'
      ? content.trim().length > 0 || hasImage
      : content.trim().length > 0;
  const canSave =
    post !== null && hasRequiredContent && !isSaving;

  const handleSave = async () => {
    const userId = session?.user.id;

    if (!post || !userId || !canSave || savePendingRef.current) {
      return;
    }

    savePendingRef.current = true;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePost({
        asset: imageAsset,
        content,
        lostFoundLocation: location,
        post,
        postKind,
        removeImage: isExistingImageRemoved,
        resolved: isResolved,
      });

      const updatedPost = await getPostById(post.id, userId);

      if (updatedPost) {
        replacePost(updatedPost);
      }

      Alert.alert(
        'Post updated',
        'Your changes are now visible on campus.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace({
                  pathname: '/post/[id]',
                  params: { id: post.id },
                });
              }
            },
          },
        ]
      );
    } catch (error) {
      console.warn('[edit-post] Could not save post.', error);
      setErrorMessage(getPostErrorMessage(error));
    } finally {
      savePendingRef.current = false;
      setIsSaving(false);
    }
  };

  const saveAction = (
    <Pressable
      accessibilityRole="button"
      disabled={!canSave}
      onPress={() => void handleSave()}
      style={({ pressed }) => [
        styles.saveButton,
        !canSave && styles.saveButtonDisabled,
        pressed && canSave && styles.pressed,
      ]}
    >
      {isSaving ? (
        <ActivityIndicator color={colors.white} size="small" />
      ) : (
        <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
          Save
        </Text>
      )}
    </Pressable>
  );

  if (isLoading) {
    return (
      <SafeAreaScreen style={styles.screen}>
        <ScreenHeader title="Edit post" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaScreen>
    );
  }

  if (!post) {
    return (
      <SafeAreaScreen style={styles.screen}>
        <ScreenHeader title="Edit post" />
        <View style={styles.center}>
          <Text style={styles.unavailableTitle}>Editing unavailable</Text>
          <Text style={styles.unavailableMessage}>
            This post no longer exists, or you do not have permission to edit it.
          </Text>
        </View>
      </SafeAreaScreen>
    );
  }

  return (
    <SafeAreaScreen style={styles.screen}>
      <ScreenHeader action={saveAction} title="Edit post" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.identityLabel}>Posting as</Text>
          <Text style={styles.identityName}>{post.author.fullName}</Text>

          <View style={styles.postKindPicker}>
            {(
              [
                ['general', 'Regular'],
                ['lost', 'Lost'],
                ['found', 'Found'],
              ] as const
            ).map(([value, label]) => {
              const selected = postKind === value;

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  key={value}
                  onPress={() => setPostKind(value)}
                  style={({ pressed }) => [
                    styles.postKindButton,
                    selected && styles.postKindButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.postKindText,
                      selected && styles.postKindTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            editable={!isSaving}
            maxLength={MAX_POST_CHARACTERS}
            multiline
            onChangeText={setContent}
            placeholder={
              postKind === 'lost'
                ? 'Describe the lost item'
                : postKind === 'found'
                  ? 'Describe the found item'
                  : "What's happening on campus?"
            }
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlignVertical="top"
            value={content}
          />

          <Text style={styles.characterCount}>
            {content.length}/{MAX_POST_CHARACTERS}
          </Text>

          {postKind !== 'general' ? (
            <>
              <Text style={styles.fieldLabel}>Campus location (optional)</Text>
              <TextInput
                editable={!isSaving}
                maxLength={MAX_LOST_FOUND_LOCATION_CHARACTERS}
                onChangeText={setLocation}
                placeholder="e.g. Main library, second floor"
                placeholderTextColor={colors.textMuted}
                style={styles.locationInput}
                value={location}
              />

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: isResolved }}
                disabled={isSaving}
                onPress={() => setIsResolved((value) => !value)}
                style={({ pressed }) => [
                  styles.resolvedRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.checkbox, isResolved && styles.checkboxSelected]}>
                  {isResolved ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.resolvedCopy}>
                  <Text style={styles.resolvedTitle}>Mark as resolved</Text>
                  <Text style={styles.resolvedMessage}>
                    Resolved items leave the open Lost & Found feed.
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}

          <PostImageField
            asset={imageAsset}
            disabled={isSaving}
            existingImageUrl={isExistingImageRemoved ? null : post.imageUrl}
            onChange={(asset) => {
              setImageAsset(asset);
              setIsExistingImageRemoved(asset === null);
            }}
            onError={setErrorMessage}
          />

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 120 },
    center: {
      flex: 1,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButton: {
      minWidth: 68,
      minHeight: 38,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    saveButtonDisabled: { backgroundColor: colors.border },
    saveText: { fontSize: 13, fontWeight: '700', color: colors.white },
    saveTextDisabled: { color: colors.textMuted },
    identityLabel: { fontSize: 11, color: colors.textMuted },
    identityName: {
      marginTop: spacing.xs,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    postKindPicker: {
      marginTop: spacing.lg,
      padding: 4,
      flexDirection: 'row',
      gap: 4,
      borderRadius: radius.full,
      backgroundColor: colors.borderSubtle,
    },
    postKindButton: {
      minHeight: 38,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    postKindButtonSelected: { backgroundColor: colors.surfaceElevated },
    postKindText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    postKindTextSelected: { color: colors.textPrimary },
    input: {
      minHeight: 170,
      maxHeight: 260,
      marginTop: spacing.lg,
      padding: 0,
      fontSize: 17,
      lineHeight: 25,
      color: colors.textPrimary,
    },
    characterCount: {
      marginTop: spacing.sm,
      textAlign: 'right',
      fontSize: 12,
      color: colors.textMuted,
    },
    fieldLabel: {
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    locationInput: {
      minHeight: 46,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      fontSize: 14,
      color: colors.textPrimary,
    },
    resolvedRow: {
      marginTop: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkbox: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 7,
    },
    checkboxSelected: {
      borderColor: colors.success,
      backgroundColor: colors.success,
    },
    checkmark: { fontSize: 14, fontWeight: '800', color: colors.white },
    resolvedCopy: { flex: 1, marginLeft: spacing.md },
    resolvedTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    resolvedMessage: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    errorText: {
      marginTop: spacing.md,
      fontSize: 13,
      lineHeight: 19,
      color: colors.danger,
    },
    unavailableTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    unavailableMessage: {
      maxWidth: 300,
      marginTop: spacing.sm,
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    pressed: { opacity: 0.55 },
  });
