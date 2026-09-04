import type { ImagePickerAsset } from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { MentionInput } from '../components/MentionInput';
import {
  CreateTypeSelector,
  type CreateContentType,
} from '../components/CreateTypeSelector';
import { ActionSheet } from '../components/moderation/ActionSheet';
import { OrganizationAvatar } from '../components/organizations/OrganizationAvatar';
import { PostImageField } from '../components/posts/PostImageField';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useFeed } from '../hooks/useFeed';
import { useProfile } from '../hooks/useProfile';
import { useThemedStyles } from '../hooks/useTheme';
import { getManageableOrganizationsForPosting } from '../lib/organizations';
import {
  getPostById,
  getPostErrorMessage,
  MAX_POST_CHARACTERS,
  publishPost,
} from '../lib/posts';
import { getInitials } from '../lib/text';
import type { ManageableOrganization } from '../types/organization';

type CreatePostScreenProps = {
  onCreateTypeChange?: (type: CreateContentType) => void;
  withinTabNavigator?: boolean;
};

export default function CreatePostScreen({
  onCreateTypeChange,
  withinTabNavigator = false,
}: CreatePostScreenProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { session } = useAuth();
  const { prependPost, refreshFeed } = useFeed();
  const { profile } = useProfile();
  const createTypeNavigationPendingRef = useRef(false);
  const publishPendingRef = useRef(false);

  const [content, setContent] = useState('');
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChangingCreateType, setIsChangingCreateType] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isIdentityPickerVisible, setIsIdentityPickerVisible] = useState(false);
  const [manageableOrganizations, setManageableOrganizations] = useState<
    ManageableOrganization[]
  >([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(null);

  const selectedOrganization =
    manageableOrganizations.find(
      (organization) => organization.id === selectedOrganizationId
    ) ?? null;

  useFocusEffect(
    useCallback(() => {
      createTypeNavigationPendingRef.current = false;
      setIsChangingCreateType(false);
    }, [])
  );

  useEffect(() => {
    const userId = session?.user.id;
    let isActive = true;

    setManageableOrganizations([]);
    setSelectedOrganizationId(null);
    setIsIdentityPickerVisible(false);

    if (!userId) {
      return () => {
        isActive = false;
      };
    }

    void getManageableOrganizationsForPosting(userId)
      .then((organizations) => {
        if (isActive) {
          setManageableOrganizations(organizations);
        }
      })
      .catch((error: unknown) => {
        console.warn('[create-post] Could not load organization identities.', error);
      });

    return () => {
      isActive = false;
    };
  }, [session?.user.id]);

  const hasPostContent = content.trim().length > 0 || imageAsset !== null;
  const canPublish = hasPostContent && !isPublishing;

  const handleCreateTypeChange = (type: CreateContentType) => {
    if (type === 'post') {
      return;
    }

    if (onCreateTypeChange) {
      onCreateTypeChange(type);
      return;
    }

    if (createTypeNavigationPendingRef.current) {
      return;
    }

    createTypeNavigationPendingRef.current = true;
    setIsChangingCreateType(true);
    router.navigate({
      pathname: '/lost-found/create',
      params: { kind: type, source: 'create' },
    });
  };

  const handlePublish = async () => {
    const userId = session?.user.id;

    if (!userId || !hasPostContent || publishPendingRef.current) {
      return;
    }

    publishPendingRef.current = true;
    setIsPublishing(true);
    setErrorMessage(null);

    try {
      const published = await publishPost({
        asset: imageAsset,
        content,
        organizationId: selectedOrganization?.id ?? null,
        userId,
      });

      try {
        const newPost = await getPostById(published.id, userId);

        if (newPost) {
          prependPost(newPost);
        } else {
          await refreshFeed(false);
        }
      } catch (feedSyncError) {
        console.warn(
          '[create-post] Post published, but local feed sync failed.',
          feedSyncError
        );
        void refreshFeed(false);
      }

      setContent('');
      setImageAsset(null);
      router.replace('/');
    } catch (error) {
      console.warn('[create-post] Publish failed.', error);
      setErrorMessage(getPostErrorMessage(error));
    } finally {
      publishPendingRef.current = false;
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaScreen
      style={styles.screen}
      withinTabNavigator={withinTabNavigator}
    >
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
          <View style={styles.header}>
            {!withinTabNavigator ? (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/')
                }
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView
                  name={{ android: 'arrow_back', ios: 'chevron.left', web: 'arrow_back' }}
                  size={22}
                  tintColor={colors.textPrimary}
                />
              </Pressable>
            ) : null}

            <Text style={styles.title}>
              {withinTabNavigator ? 'Create' : 'New post'}
            </Text>

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

          <CreateTypeSelector
            disabled={isPublishing || isChangingCreateType}
            onChange={handleCreateTypeChange}
            value="post"
          />

          <Pressable
            accessibilityRole={
              manageableOrganizations.length > 0 ? 'button' : undefined
            }
            disabled={manageableOrganizations.length === 0 || isPublishing}
            onPress={() => setIsIdentityPickerVisible(true)}
            style={({ pressed }) => [
              styles.authorRow,
              pressed && styles.pressed,
            ]}
          >
            {selectedOrganization ? (
              <OrganizationAvatar
                name={selectedOrganization.name}
                size={42}
                uri={selectedOrganization.avatarUrl}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(profile?.full_name ?? 'Student')}
                </Text>
              </View>
            )}

            <View style={styles.authorCopy}>
              <Text numberOfLines={1} style={styles.authorName}>
                {selectedOrganization?.name ?? profile?.full_name ?? 'Student'}
              </Text>
              <Text numberOfLines={1} style={styles.authorMeta}>
                {selectedOrganization
                  ? `Official organization · ${selectedOrganization.campusShortName}`
                  : profile
                    ? `${profile.branch} · ${formatYear(profile.year)}`
                    : 'Campus member'}
              </Text>
            </View>

            {manageableOrganizations.length > 0 ? (
              <SymbolView
                name={{ android: 'expand_more', ios: 'chevron.down', web: 'expand_more' }}
                size={17}
                tintColor={colors.textSecondary}
              />
            ) : null}
          </Pressable>

          <MentionInput
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

          <Text style={styles.characterCount}>
            {content.length}/{MAX_POST_CHARACTERS}
          </Text>

          <PostImageField
            asset={imageAsset}
            disabled={isPublishing}
            onChange={setImageAsset}
            onError={setErrorMessage}
          />

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ActionSheet
        actions={[
          {
            label: profile?.full_name ?? 'My student profile',
            onPress: () => setSelectedOrganizationId(null),
          },
          ...manageableOrganizations.map((organization) => ({
            label: organization.name,
            onPress: () => setSelectedOrganizationId(organization.id),
          })),
        ]}
        message="Choose who this post is published as."
        onClose={() => setIsIdentityPickerVisible(false)}
        title="Post as"
        visible={isIdentityPickerVisible}
      />
    </SafeAreaScreen>
  );
}

function formatYear(year: number) {
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';
  return `${year}${suffix} year`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: 120,
    },
    header: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      marginLeft: -spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    publishButton: {
      minWidth: 84,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    publishButtonDisabled: { backgroundColor: colors.border },
    publishText: { fontSize: 13, fontWeight: '700', color: colors.white },
    publishTextDisabled: { color: colors.textMuted },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: colors.textPrimary,
    },
    avatarText: { fontSize: 13, fontWeight: '700', color: colors.white },
    authorCopy: { flex: 1, marginLeft: spacing.md },
    authorName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    authorMeta: { marginTop: 3, fontSize: 12, color: colors.textSecondary },
    input: {
      minHeight: 180,
      maxHeight: 280,
      marginTop: spacing.xl,
      padding: 0,
      fontSize: 18,
      lineHeight: 27,
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
    pressed: { opacity: 0.55 },
  });
