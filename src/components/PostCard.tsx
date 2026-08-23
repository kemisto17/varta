import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { getInitials } from '../lib/text';
import { formatRelativeTimestamp } from '../lib/time';
import type { FeedPost } from '../types/post';

type PostCardProps = {
  currentUserId: string | null;
  isDeleting?: boolean;
  onDelete?: (post: FeedPost) => void;
  post: FeedPost;
};

export function PostCard({
  currentUserId,
  isDeleting = false,
  onDelete,
  post,
}: PostCardProps) {
  const canDelete = post.authorId === currentUserId && onDelete !== undefined;

  const confirmDelete = () => {
    if (!canDelete || isDeleting) {
      return;
    }

    Alert.alert(
      'Delete this post?',
      'This removes the post and its photo from the campus feed.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => onDelete(post),
          style: 'destructive',
          text: 'Delete',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(post.author.fullName)}
            </Text>
          </View>

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
        </View>

        {canDelete ? (
          <Pressable
            accessibilityLabel="Post options"
            accessibilityRole="button"
            disabled={isDeleting}
            hitSlop={12}
            onPress={confirmDelete}
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

      {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

      {post.imageUrl ? (
        <View style={styles.imageFrame}>
          <Image
            accessibilityLabel={`Photo posted by ${post.author.fullName}`}
            contentFit="cover"
            source={{ uri: post.imageUrl }}
            style={styles.image}
            transition={180}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <View
          accessibilityLabel={`${post.likeCount} likes`}
          style={styles.action}
        >
          <SymbolView
            name={{
              android: 'favorite_border',
              ios: 'heart',
              web: 'favorite_border',
            }}
            size={20}
            tintColor={colors.textSecondary}
          />
          <Text style={styles.actionText}>{post.likeCount}</Text>
        </View>

        <View
          accessibilityLabel={`${post.commentCount} comments`}
          style={styles.action}
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
        </View>
      </View>
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

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
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

  pressed: {
    opacity: 0.55,
  },
});
