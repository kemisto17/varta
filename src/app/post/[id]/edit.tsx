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
  View,
} from 'react-native';

import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import { MentionInput } from '../../../components/MentionInput';
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
  MAX_POST_CHARACTERS,
  updatePost,
} from '../../../lib/posts';
import type { FeedPost } from '../../../types/post';

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

        if (result.postKind !== 'general') {
          router.replace({
            pathname: '/lost-found/[id]/edit',
            params: { id: result.id },
          });
          return;
        }

        setPost(result);
        setContent(result.content);
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
  }, [postId, router, session?.user.id]);

  const hasImage =
    imageAsset !== null ||
    (post?.imagePath !== null && !isExistingImageRemoved);
  const hasRequiredContent = content.trim().length > 0 || hasImage;
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
        post,
        postKind: 'general',
        removeImage: isExistingImageRemoved,
        resolved: false,
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

          <MentionInput
            editable={!isSaving}
            maxLength={MAX_POST_CHARACTERS}
            multiline
            onChangeText={setContent}
            placeholder="What's happening on campus?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlignVertical="top"
            value={content}
          />

          <Text style={styles.characterCount}>
            {content.length}/{MAX_POST_CHARACTERS}
          </Text>

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
