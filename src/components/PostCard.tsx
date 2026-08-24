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

import { colors, radius, spacing } from '../constants/theme';
import { formatRelativeTimestamp } from '../lib/time';
import type { FeedPost } from '../types/post';
import { Avatar } from './Avatar';
import { FullscreenImageViewer } from './FullscreenImageViewer';
import { ActionSheet } from './moderation/ActionSheet';

type PostCardProps = {
  currentUserId: string | null;
  isDeleting?: boolean;
  isLikePending?: boolean;
  onAuthorPress?: (post: FeedPost) => void;
  onBlockUser?: (post: FeedPost) => void;
  onCommentPress?: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
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
  onOpenPost,
  onReport,
  onToggleLike,
  post,
}: PostCardProps) {
  const canDelete = post.authorId === currentUserId && onDelete !== undefined;
  const canModerate =
    currentUserId !== null && post.authorId !== currentUserId;
  const hasOptions =
    canDelete || (canModerate && (onReport !== undefined || onBlockUser !== undefined));
  const [imageFailed, setImageFailed] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setIsImageViewerVisible(false);
    setIsOptionsVisible(false);
  }, [post.id, post.imageUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={`Open ${post.author.fullName}'s profile`}
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
            <Text numberOfLines={1} style={styles.name}>
              {post.author.fullName}
            </Text>
            <Text numberOfLines={1} style={styles.identityMeta}>
              @{post.author.username} · {post.author.institute.shortName}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {post.author.branch} · {formatYear(post.author.year)} ·{' '}
              {formatRelativeTimestamp(post.createdAt)}
            </Text>
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
              <ActivityIndicator color={colors.textSecondary} size="small" />
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
          style={({ pressed }) => pressed && onOpenPost && styles.bodyPressed}
        >
          <Text style={styles.content}>{post.content}</Text>
        </Pressable>
      ) : null}

      {post.imageUrl && !imageFailed ? (
        <Pressable
          accessibilityLabel={`View photo posted by ${post.author.fullName} fullscreen`}
          accessibilityRole="button"
          onPress={() => setIsImageViewerVisible(true)}
          style={({ pressed }) => pressed && styles.imagePressed}
        >
          <View style={styles.imageFrame}>
            <Image
              accessibilityLabel={`Photo posted by ${post.author.fullName}`}
              cachePolicy="memory-disk"
              contentFit="cover"
              onError={() => setImageFailed(true)}
              source={{ uri: post.imageUrl }}
              style={styles.image}
              transition={180}
            />
          </View>
        </Pressable>
      ) : post.imageUrl && imageFailed ? (
        <View style={styles.imageUnavailable}>
          <Text style={styles.imageUnavailableText}>Photo unavailable</Text>
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
              post.isLikedByCurrentUser ? colors.danger : colors.textSecondary
            }
          />
          <Text
            style={[
              styles.actionText,
              post.isLikedByCurrentUser && styles.likedActionText,
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
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </Pressable>
      </View>

      <FullscreenImageViewer
        images={
          post.imageUrl
            ? [
                {
                  accessibilityLabel: `Photo posted by ${post.author.fullName}`,
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
          canDelete
            ? [
                {
                  label: 'Delete post',
                  onPress: () => onDelete(post),
                  tone: 'danger' as const,
                },
              ]
            : [
                ...(onReport
                  ? [
                      {
                        label: 'Report post',
                        onPress: () => onReport(post),
                      },
                    ]
                  : []),
                ...(onBlockUser
                  ? [
                      {
                        label: `Block ${post.author.fullName}`,
                        onPress: () => onBlockUser(post),
                        tone: 'danger' as const,
                      },
                    ]
                  : []),
              ]
        }
        message={
          canDelete
            ? 'This removes the post and its photo from the campus feed. This cannot be undone.'
            : null
        }
        onClose={() => setIsOptionsVisible(false)}
        title={canDelete ? 'Delete this post?' : 'Post options'}
        visible={isOptionsVisible}
      />
    </View>
  );
}

function formatYear(year: number) {
  const suffix = year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th';

  return `${year}${suffix} year`;
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
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
    aspectRatio: 4 / 3,
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
