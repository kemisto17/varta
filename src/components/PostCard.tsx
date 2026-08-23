import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors, spacing } from '../constants/theme';
import { Post } from '../types/post';

type PostCardProps = {
  post: Post;
};

export function PostCard({ post }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);

  const handleLike = () => {
    setLiked((currentLiked) => {
      setLikeCount((currentCount) =>
        currentLiked ? currentCount - 1 : currentCount + 1
      );

      return !currentLiked;
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Post header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(post.author.name)}
            </Text>
          </View>

          <View style={styles.author}>
            <Text style={styles.name}>
              {post.author.name}
            </Text>

            <Text style={styles.meta}>
              {post.author.branch}
              {' · '}
              {post.author.year} Year
              {' · '}
              {post.createdAt}
            </Text>
          </View>
        </View>

        <Pressable
          hitSlop={12}
          style={({ pressed }) => [
            styles.moreButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              ios: 'ellipsis',
              android: 'more_horiz',
              web: 'more_horiz',
            }}
            size={20}
            tintColor={colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Post content */}
      <Text style={styles.content}>
        {post.content}
      </Text>

      {/* Post actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleLike}
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              ios: liked ? 'heart.fill' : 'heart',
              android: liked ? 'favorite' : 'favorite_border',
              web: liked ? 'favorite' : 'favorite_border',
            }}
            size={21}
            tintColor={
              liked
                ? colors.textPrimary
                : colors.textSecondary
            }
          />

          <Text
            style={[
              styles.actionText,
              liked && styles.activeActionText,
            ]}
          >
            {likeCount}
          </Text>
        </Pressable>

        <Pressable
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{
              ios: 'bubble.left',
              android: 'chat_bubble_outline',
              web: 'chat_bubble_outline',
            }}
            size={20}
            tintColor={colors.textSecondary}
          />

          <Text style={styles.actionText}>
            {post.commentCount}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontWeight: '600',
    color: colors.textPrimary,
  },

  meta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },

  moreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    marginTop: spacing.md,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },

  actions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },

  actionButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  activeActionText: {
    color: colors.textPrimary,
  },

  pressed: {
    opacity: 0.55,
  },
});