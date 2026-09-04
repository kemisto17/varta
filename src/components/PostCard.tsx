import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useTheme';
import { formatRelativeTimestamp } from '../lib/time';
import type { FeedPost } from '../types/post';
import { Avatar } from './Avatar';
import { FullscreenImageViewer } from './FullscreenImageViewer';
import { BadgePill } from './badges/BadgePill';
import { LinkifiedText } from './links/LinkifiedText';
import { ActionSheet } from './moderation/ActionSheet';

const DEFAULT_FEED_IMAGE_ASPECT_RATIO = 4 / 3;
const MIN_FEED_IMAGE_ASPECT_RATIO = 2 / 3;

type PostCardProps = {
  currentUserId: string | null;
  isDeleting?: boolean;
  isLikePending?: boolean;
  onAuthorPress?: (post: FeedPost) => void;
  onBlockUser?: (post: FeedPost) => void;
  onCommentPress?: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
  onEdit?: (post: FeedPost) => void;
  onMentionPress?: (username: string) => void;
  onOpenPost?: (post: FeedPost) => void;
  onReport?: (post: FeedPost) => void;
  onToggleLike?: (post: FeedPost) => void;
  post: FeedPost;
};

export function PostCard({
  currentUserId,
  isDeleting = false,
  isLikePending = false,
  onAuthorPress,
  onBlockUser,
  onCommentPress,
  onDelete,
  onEdit,
  onMentionPress,
  onOpenPost,
  onReport,
  onToggleLike,
  post,
}: PostCardProps) {
  const { colors, styles } = useThemedStyles(createStyles);

  const canDelete =
    post.canDeleteByCurrentUser &&
    onDelete !== undefined;

  const canEdit =
    post.canEditByCurrentUser &&
    onEdit !== undefined;

  const canReport =
    currentUserId !== null &&
    !post.canDeleteByCurrentUser &&
    onReport !== undefined;

  const canBlock =
    post.author.kind === 'student' &&
    currentUserId !== null &&
    post.authorId !== currentUserId &&
    onBlockUser !== undefined;

  const hasOptions =
    canDelete ||
    canEdit ||
    canReport ||
    canBlock;

  const [imageFailed, setImageFailed] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(
    DEFAULT_FEED_IMAGE_ASPECT_RATIO
  );
  const [isImageViewerVisible, setIsImageViewerVisible] =
    useState(false);
  const [isOptionsVisible, setIsOptionsVisible] =
    useState(false);

  useEffect(() => {
    setImageFailed(false);
    setImageAspectRatio(DEFAULT_FEED_IMAGE_ASPECT_RATIO);
    setIsImageViewerVisible(false);
    setIsOptionsVisible(false);
  }, [post.id, post.imageUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={`Open ${post.author.fullName}`}
          accessibilityRole={onAuthorPress ? 'button' : undefined}
          disabled={!onAuthorPress}
          onPress={() => onAuthorPress?.(post)}
          style={({ pressed }) => [
            styles.userInfo,
            pressed && onAuthorPress && styles.pressed,
          ]}
        >
          <Avatar
            fullName={post.author.fullName}
            uri={post.author.avatarUrl}
            verified={post.author.isVerified}
          />

          <View style={styles.author}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={styles.name}
              >
                {post.author.fullName}
              </Text>

              {post.author.primaryBadge ? (
                <BadgePill
                  badge={post.author.primaryBadge}
                  compact
                />
              ) : null}
            </View>

            {post.author.kind === 'student' ? (
              <>
                <Text
                  numberOfLines={1}
                  style={styles.identityMeta}
                >
                  @{post.author.username} ·{' '}
                  {post.author.institute.shortName}
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.meta}
                >
                  {post.author.branch} ·{' '}
                  {formatYear(post.author.year)} ·{' '}
                  {formatRelativeTimestamp(post.createdAt)}
                  {post.updatedAt !==
                  post.createdAt
                    ? ' · Edited'
                    : ''}
                </Text>
              </>
            ) : (
              <>
                <Text
                  numberOfLines={1}
                  style={styles.identityMeta}
                >
                  Official organization ·{' '}
                  {post.author.campusShortName}
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.meta}
                >
                  {formatRelativeTimestamp(post.createdAt)}
                  {post.updatedAt !==
                  post.createdAt
                    ? ' · Edited'
                    : ''}
                </Text>
              </>
            )}
          </View>
        </Pressable>

        {hasOptions ? (
          <Pressable
            accessibilityLabel="Post options"
            accessibilityRole="button"
            disabled={isDeleting}
            hitSlop={12}
            onPress={() => setIsOptionsVisible(true)}
            style={({ pressed }) => [
              styles.moreButton,
              pressed && styles.pressed,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator
                color={colors.textSecondary}
                size="small"
              />
            ) : (
              <SymbolView
                name={{
                  android: 'more_horiz',
                  ios: 'ellipsis',
                  web: 'more_horiz',
                }}
                size={20}
                tintColor={colors.textSecondary}
              />
            )}
          </Pressable>
        ) : null}
      </View>

      {post.content ? (
        <Pressable
          accessibilityRole={onOpenPost ? 'button' : undefined}
          disabled={!onOpenPost}
          onPress={() => onOpenPost?.(post)}
          style={({ pressed }) =>
            pressed &&
            onOpenPost &&
            styles.bodyPressed
          }
        >
          <LinkifiedText
            onMentionPress={onMentionPress}
            style={styles.content}
          >
            {post.content}
          </LinkifiedText>
        </Pressable>
      ) : null}

      {post.imageUrl && !imageFailed ? (
        <Pressable
          accessibilityLabel={`View photo posted by ${post.author.fullName} fullscreen`}
          accessibilityRole="button"
          onPress={() => setIsImageViewerVisible(true)}
          style={({ pressed }) =>
            pressed && styles.imagePressed
          }
        >
          <View
            style={[
              styles.imageFrame,
              { aspectRatio: imageAspectRatio },
            ]}
          >
            <Image
              accessibilityLabel={`Photo posted by ${post.author.fullName}`}
              cachePolicy="memory-disk"
              contentFit="contain"
              recyclingKey={post.imageUrl}
              source={post.imageUrl}
              style={styles.image}
              transition={180}
              onError={() => {
                setImageFailed(true);
              }}
              onLoad={({ source }) => {
                if (source.width > 0 && source.height > 0) {
                  setImageAspectRatio(
                    Math.max(
                      source.width / source.height,
                      MIN_FEED_IMAGE_ASPECT_RATIO
                    )
                  );
                }
              }}
            />
          </View>
        </Pressable>
      ) : post.imageUrl && imageFailed ? (
        <View style={styles.imageUnavailable}>
          <Text style={styles.imageUnavailableText}>
            Photo unavailable
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`${post.likeCount} likes`}
          accessibilityRole="button"
          accessibilityState={{
            busy: isLikePending,
            checked: post.isLikedByCurrentUser,
          }}
          disabled={!onToggleLike || isLikePending}
          hitSlop={8}
          onPress={() => onToggleLike?.(post)}
          style={({ pressed }) => [
            styles.action,
            isLikePending && styles.actionPending,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={
              post.isLikedByCurrentUser
                ? {
                    android: 'favorite',
                    ios: 'heart.fill',
                    web: 'favorite',
                  }
                : {
                    android: 'favorite_border',
                    ios: 'heart',
                    web: 'favorite_border',
                  }
            }
            size={20}
            tintColor={
              post.isLikedByCurrentUser
                ? colors.danger
                : colors.textSecondary
            }
          />

          <Text
            style={[
              styles.actionText,
              post.isLikedByCurrentUser &&
                styles.likedActionText,
            ]}
          >
            {post.likeCount}
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel={`${post.commentCount} comments`}
          accessibilityRole="button"
          disabled={!onCommentPress}
          hitSlop={8}
          onPress={() => onCommentPress?.(post)}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              android: 'chat_bubble_outline',
              ios: 'bubble.left',
              web: 'chat_bubble_outline',
            }}
            size={19}
            tintColor={colors.textSecondary}
          />

          <Text style={styles.actionText}>
            {post.commentCount}
          </Text>
        </Pressable>
      </View>

      <FullscreenImageViewer
        images={
          post.imageUrl
            ? [
                {
                  accessibilityLabel:
                    `Photo posted by ${post.author.fullName}`,
                  uri: post.imageUrl,
                },
              ]
            : []
        }
        onClose={() => setIsImageViewerVisible(false)}
        visible={isImageViewerVisible}
      />

      <ActionSheet
        actions={
          canDelete || canEdit
            ? [
                ...(canEdit
                  ? [
                      {
                        label: 'Edit post',
                        onPress: () => onEdit?.(post),
                      },
                    ]
                  : []),

                ...(canDelete
                  ? [
                {
                  label: 'Delete post',
                  onPress: () => onDelete?.(post),
                  tone: 'danger' as const,
                },
                    ]
                  : []),
              ]
            : [
                ...(canReport
                  ? [
                      {
                        label: 'Report post',
                        onPress: () => onReport?.(post),
                      },
                    ]
                  : []),

                ...(canBlock
                  ? [
                      {
                        label: `Block ${post.author.fullName}`,
                        onPress: () => onBlockUser?.(post),
                        tone: 'danger' as const,
                      },
                    ]
                  : []),
              ]
        }
        message={
          canDelete || canEdit
            ? 'Choose what you want to do with this post.'
            : null
        }
        onClose={() => setIsOptionsVisible(false)}
        title={
          canDelete || canEdit
            ? 'Post options'
            : 'Post options'
        }
        visible={isOptionsVisible}
      />
    </View>
  );
}

function formatYear(year: number) {
  const suffix =
    year === 1
      ? 'st'
      : year === 2
        ? 'nd'
        : year === 3
          ? 'rd'
          : 'th';

  return `${year}${suffix} year`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },

    userInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },

    author: {
      marginLeft: spacing.md,
      flex: 1,
    },

    name: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },

    identityMeta: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },

    meta: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textMuted,
    },

    moreButton: {
      width: 36,
      height: 36,
      marginLeft: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },

    content: {
      marginTop: spacing.md,
      fontSize: 16,
      lineHeight: 24,
      color: colors.textPrimary,
    },

    imageFrame: {
      width: '100%',
      marginTop: spacing.md,
      overflow: 'hidden',
      borderRadius: radius.lg,
      backgroundColor: colors.borderSubtle,
    },

    image: {
      width: '100%',
      height: '100%',
    },

    imageUnavailable: {
      minHeight: 52,
      marginTop: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.borderSubtle,
    },

    imageUnavailableText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
    },

    actions: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },

    action: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    actionText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    likedActionText: {
      color: colors.danger,
    },

    actionPending: {
      opacity: 0.58,
    },

    bodyPressed: {
      opacity: 0.72,
    },

    imagePressed: {
      opacity: 0.86,
    },

    pressed: {
      opacity: 0.55,
    },
  });
