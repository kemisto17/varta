import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostCard } from '../components/PostCard';
import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useFeed } from '../hooks/useFeed';
import { useSavedPosts } from '../hooks/useSavedPosts';
import { useThemedStyles } from '../hooks/useTheme';
import { getMentionedProfileId } from '../lib/mentions';
import { getInteractionErrorMessage, setPostLike } from '../lib/postInteractions';
import {
  getSavedPostsErrorMessage,
  getSavedPostsPage,
  type SavedPostCursor,
} from '../lib/savedPosts';
import type { FeedPost } from '../types/post';

type PageStatus = 'loading' | 'ready' | 'error';

export default function SavedPostsScreen() {
  const router = useRouter();
  const { colors, styles } = useThemedStyles(createStyles);
  const { session } = useAuth();
  const { updatePostLike } = useFeed();
  const {
    isReady: savedStateReady,
    pendingPostIds: savePendingIds,
    refreshSavedPosts,
    savedPostIds,
  } = useSavedPosts();
  const userId = session?.user.id ?? null;
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const likeRequestsRef = useRef(new Set<string>());
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<SavedPostCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [likePendingIds, setLikePendingIds] = useState(new Set<string>());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInitial = useCallback(async (showRefresh = false) => {
    if (!userId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showRefresh) setIsRefreshing(true);
    else setStatus('loading');
    setErrorMessage(null);

    try {
      const [page] = await Promise.all([
        getSavedPostsPage(userId),
        refreshSavedPosts(),
      ]);
      if (requestIdRef.current !== requestId) return;
      setPosts(page.posts);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setStatus('ready');
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      console.warn('[saved-posts] Could not load saved posts.', error);
      setErrorMessage(getSavedPostsErrorMessage());
      setStatus('error');
    } finally {
      if (requestIdRef.current === requestId) setIsRefreshing(false);
    }
  }, [refreshSavedPosts, userId]);

  useFocusEffect(useCallback(() => {
    void loadInitial();
    return () => { requestIdRef.current += 1; };
  }, [loadInitial]));

  useEffect(() => {
    if (!savedStateReady) return;
    setPosts((current) => current.filter(
      (post) => savedPostIds.has(post.id) || savePendingIds.has(post.id)
    ));
  }, [savePendingIds, savedPostIds, savedStateReady]);

  const loadMore = useCallback(async () => {
    if (!userId || !cursor || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const requestId = requestIdRef.current;

    try {
      const page = await getSavedPostsPage(userId, cursor);
      if (requestIdRef.current !== requestId) return;
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !known.has(post.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[saved-posts] Could not load more saved posts.', error);
      setErrorMessage('More saved posts could not be loaded. Pull down to retry.');
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, userId]);

  const toggleLike = useCallback(async (post: FeedPost) => {
    if (!userId || likeRequestsRef.current.has(post.id)) return;
    const nextIsLiked = !post.isLikedByCurrentUser;
    const nextLikeCount = Math.max(0, post.likeCount + (nextIsLiked ? 1 : -1));
    likeRequestsRef.current.add(post.id);
    setLikePendingIds((current) => new Set(current).add(post.id));
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, isLikedByCurrentUser: nextIsLiked, likeCount: nextLikeCount }
      : item));
    updatePostLike(post.id, {
      isLikedByCurrentUser: nextIsLiked,
      likeCount: nextLikeCount,
    });

    try {
      await setPostLike({ isLiked: nextIsLiked, postId: post.id, userId });
    } catch (error) {
      console.warn('[saved-posts] Could not update post like.', error);
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, isLikedByCurrentUser: post.isLikedByCurrentUser, likeCount: post.likeCount }
        : item));
      updatePostLike(post.id, {
        isLikedByCurrentUser: post.isLikedByCurrentUser,
        likeCount: post.likeCount,
      });
      setErrorMessage(getInteractionErrorMessage(error));
    } finally {
      likeRequestsRef.current.delete(post.id);
      setLikePendingIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  }, [updatePostLike, userId]);

  const openPost = useCallback((post: FeedPost) => {
    router.push({ pathname: '/post/[id]', params: { id: post.id } });
  }, [router]);

  const openAuthor = useCallback((post: FeedPost) => {
    if (post.author.kind === 'organization') {
      router.push({ pathname: '/organization/[id]', params: { id: post.author.id } });
    } else if (post.authorId) {
      router.push({ pathname: '/user/[id]', params: { id: post.authorId } });
    }
  }, [router]);

  const openMention = useCallback(async (username: string) => {
    try {
      const profileId = await getMentionedProfileId(username);
      if (profileId) router.push({ pathname: '/user/[id]', params: { id: profileId } });
    } catch (error) {
      console.warn('[saved-posts] Could not open mentioned profile.', error);
    }
  }, [router]);

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title="Saved posts" />
      <FlatList
        contentContainerStyle={[styles.content, posts.length === 0 && styles.emptyContent]}
        data={posts}
        keyExtractor={(post) => post.id}
        ListEmptyComponent={status === 'loading' ? (
          <ActivityIndicator color={colors.textSecondary} />
        ) : status === 'error' ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>Could not load saved posts</Text>
            <Text style={styles.stateMessage}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadInitial()}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.state}>
            <SymbolView
              name={{ android: 'bookmark_border', ios: 'bookmark', web: 'bookmark_border' }}
              size={30}
              tintColor={colors.textMuted}
            />
            <Text style={styles.stateTitle}>No saved posts yet</Text>
            <Text style={styles.stateMessage}>Posts you save will appear here.</Text>
          </View>
        )}
        ListFooterComponent={isLoadingMore ? (
          <ActivityIndicator color={colors.textSecondary} style={styles.footer} />
        ) : null}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            colors={[colors.textPrimary]}
            onRefresh={() => void loadInitial(true)}
            progressBackgroundColor={colors.surfaceElevated}
            refreshing={isRefreshing}
            tintColor={colors.textPrimary}
          />
        }
        renderItem={({ item }) => (
          <PostCard
            currentUserId={userId}
            isLikePending={likePendingIds.has(item.id)}
            onAuthorPress={openAuthor}
            onCommentPress={openPost}
            onMentionPress={(username) => void openMention(username)}
            onOpenPost={openPost}
            onToggleLike={toggleLike}
            post={item}
          />
        )}
      />
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  state: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  stateTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  stateMessage: { textAlign: 'center', fontSize: 14, color: colors.textSecondary },
  retry: { minHeight: 44, paddingTop: spacing.md, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  footer: { paddingVertical: spacing.lg },
});
