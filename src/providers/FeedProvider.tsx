import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { FeedStatus } from '../contexts/FeedContext';
import { FeedContext } from '../contexts/FeedContext';
import { useAuth } from '../hooks/useAuth';
import { getFeedPage } from '../lib/posts';
import type { FeedCursor, FeedPost } from '../types/post';

export function FeedProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const requestId = useRef(0);
  const postsRef = useRef<FeedPost[]>([]);
  const cursorRef = useRef<FeedCursor | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const removedPostIdsRef = useRef(new Set<string>());
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [status, setStatus] = useState<FeedStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const refreshFeed = useCallback(async () => {
    if (!userId) {
      return;
    }

    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;
    const hasExistingPosts = postsRef.current.length > 0;

    if (hasExistingPosts) {
      setIsRefreshing(true);
    } else {
      setStatus('loading');
    }

    setErrorMessage(null);

    try {
      const page = await getFeedPage(userId);

      if (requestId.current !== activeRequestId) {
        return;
      }

      const visiblePosts = page.posts.filter(
        (post) => !removedPostIdsRef.current.has(post.id)
      );

      postsRef.current = visiblePosts;
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setPosts(visiblePosts);
      setHasMore(page.hasMore);
      setStatus('ready');
    } catch (error) {
      if (requestId.current !== activeRequestId) {
        return;
      }

      console.warn('[feed] Could not load campus posts.', error);
      setErrorMessage('We could not load the campus feed. Pull down or try again.');
      setStatus(hasExistingPosts ? 'ready' : 'error');
    } finally {
      if (requestId.current === activeRequestId) {
        setIsRefreshing(false);
      }
    }
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (
      !userId ||
      loadingMoreRef.current ||
      !hasMoreRef.current ||
      !cursorRef.current ||
      postsRef.current.length === 0
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const activeRequestId = requestId.current;

    try {
      const page = await getFeedPage(userId, cursorRef.current);

      if (requestId.current !== activeRequestId) {
        return;
      }

      const existingIds = new Set(postsRef.current.map((post) => post.id));
      const newPosts = page.posts.filter(
        (post) =>
          !existingIds.has(post.id) && !removedPostIdsRef.current.has(post.id)
      );
      const nextPosts = [...postsRef.current, ...newPosts];

      postsRef.current = nextPosts;
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setPosts(nextPosts);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[feed] Could not load more campus posts.', error);
      setErrorMessage('We could not load more posts. Please try again.');
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [userId]);

  const removePost = useCallback((postId: string) => {
    removedPostIdsRef.current.add(postId);
    const nextPosts = postsRef.current.filter((post) => post.id !== postId);

    postsRef.current = nextPosts;
    setPosts(nextPosts);
  }, []);

  const updatePostLike = useCallback(
    (
      postId: string,
      state: Pick<FeedPost, 'isLikedByCurrentUser' | 'likeCount'>
    ) => {
      const nextPosts = postsRef.current.map((post) =>
        post.id === postId ? { ...post, ...state } : post
      );

      postsRef.current = nextPosts;
      setPosts(nextPosts);
    },
    []
  );

  const value = useMemo(
    () => ({
      errorMessage,
      hasMore,
      isLoadingMore,
      isRefreshing,
      loadMore,
      posts,
      refreshFeed,
      removePost,
      status,
      updatePostLike,
    }),
    [
      errorMessage,
      hasMore,
      isLoadingMore,
      isRefreshing,
      loadMore,
      posts,
      refreshFeed,
      removePost,
      status,
      updatePostLike,
    ]
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}
