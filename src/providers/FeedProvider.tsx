import type { PropsWithChildren } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { FeedStatus } from '../contexts/FeedContext';
import { FeedContext } from '../contexts/FeedContext';
import { useAuth } from '../hooks/useAuth';
import { getFeedPage } from '../lib/posts';
import type {
  FeedCursor,
  FeedPost,
} from '../types/post';

export function FeedProvider({
  children,
}: PropsWithChildren) {
  const { session } = useAuth();

  const userId =
    session?.user.id ?? null;

  const requestId =
    useRef(0);

  const postsRef =
    useRef<FeedPost[]>([]);

  const cursorRef =
    useRef<FeedCursor | null>(
      null
    );

  const hasMoreRef =
    useRef(true);

  const hasLoadedRef =
    useRef(false);

  const loadingMoreRef =
    useRef(false);

  const refreshingRef =
    useRef(false);

  const removedPostIdsRef =
    useRef(
      new Set<string>()
    );

  const [
    posts,
    setPosts,
  ] =
    useState<
      FeedPost[]
    >([]);

  const [
    stateUserId,
    setStateUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    status,
    setStatus,
  ] =
    useState<FeedStatus>(
      'idle'
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    hasMore,
    setHasMore,
  ] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    isLoadingMore,
    setIsLoadingMore,
  ] =
    useState(false);

  /*
   * Feed state belongs to the
   * authenticated user.
   *
   * Clear every cache/reference when
   * the account changes so posts from
   * one account can never leak into
   * another account's feed state.
   */
  useEffect(() => {
    requestId.current += 1;

    setStateUserId(
      userId
    );

    postsRef.current = [];
    cursorRef.current = null;
    hasMoreRef.current = true;
    hasLoadedRef.current = false;
    loadingMoreRef.current = false;
    refreshingRef.current = false;

    removedPostIdsRef.current =
      new Set<string>();

    setPosts([]);
    setHasMore(true);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setErrorMessage(null);
    setStatus('idle');
  }, [userId]);

  const refreshFeed =
    useCallback(
      async (
        showRefreshState =
          false
      ) => {
        if (!userId) {
          return;
        }

        /*
         * A first-page refresh invalidates
         * any pagination request already
         * in flight.
         *
         * Release the old pagination lock
         * here, then block new load-more
         * requests until this refresh
         * finishes.
         */
        refreshingRef.current =
          true;

        loadingMoreRef.current =
          false;

        setIsLoadingMore(
          false
        );

        const activeRequestId =
          requestId.current +
          1;

        requestId.current =
          activeRequestId;

        const hasLoaded =
          hasLoadedRef.current;

        if (
          hasLoaded &&
          showRefreshState
        ) {
          setIsRefreshing(
            true
          );
        } else if (
          !hasLoaded
        ) {
          setStatus(
            'loading'
          );
        }

        setErrorMessage(
          null
        );

        try {
          const page =
            await getFeedPage(
              userId
            );

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          const visiblePosts =
            page.posts.filter(
              (post) =>
                !removedPostIdsRef.current.has(
                  post.id
                )
            );

          postsRef.current =
            visiblePosts;

          cursorRef.current =
            page.cursor;

          hasMoreRef.current =
            page.hasMore;

          hasLoadedRef.current =
            true;

          setStateUserId(
            userId
          );

          setPosts(
            visiblePosts
          );

          setHasMore(
            page.hasMore
          );

          setStatus(
            'ready'
          );
        } catch (error) {
          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          console.warn(
            '[feed] Could not load campus posts.',
            error
          );

          setErrorMessage(
            'We could not load the campus feed. Pull down or try again.'
          );

          setStatus(
            hasLoaded
              ? 'ready'
              : 'error'
          );
        } finally {
          if (
            requestId.current ===
            activeRequestId
          ) {
            refreshingRef.current =
              false;

            setIsRefreshing(
              false
            );
          }
        }
      },
      [userId]
    );

  const loadMore =
    useCallback(
      async () => {
        if (
          !userId ||
          refreshingRef.current ||
          loadingMoreRef.current ||
          !hasMoreRef.current ||
          !cursorRef.current ||
          postsRef.current
            .length === 0
        ) {
          return;
        }

        loadingMoreRef.current =
          true;

        setIsLoadingMore(
          true
        );

        setErrorMessage(
          null
        );

        const activeRequestId =
          requestId.current;

        try {
          const page =
            await getFeedPage(
              userId,
              cursorRef.current
            );

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          const existingIds =
            new Set(
              postsRef.current.map(
                (post) =>
                  post.id
              )
            );

          const newPosts =
            page.posts.filter(
              (post) =>
                !existingIds.has(
                  post.id
                ) &&
                !removedPostIdsRef.current.has(
                  post.id
                )
            );

          const nextPosts =
            [
              ...postsRef.current,
              ...newPosts,
            ];

          postsRef.current =
            nextPosts;

          cursorRef.current =
            page.cursor;

          hasMoreRef.current =
            page.hasMore;

          setPosts(
            nextPosts
          );

          setHasMore(
            page.hasMore
          );
        } catch (error) {
          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          console.warn(
            '[feed] Could not load more campus posts.',
            error
          );

          setErrorMessage(
            'We could not load more posts. Please try again.'
          );
        } finally {
          if (
            requestId.current ===
            activeRequestId
          ) {
            loadingMoreRef.current =
              false;

            setIsLoadingMore(
              false
            );
          }
        }
      },
      [userId]
    );

  /*
   * Insert a newly created post into
   * the already-loaded feed.
   */
  const prependPost =
    useCallback(
      (
        post: FeedPost
      ) => {
        removedPostIdsRef.current.delete(
          post.id
        );

        const withoutExisting =
          postsRef.current.filter(
            (existingPost) =>
              existingPost.id !==
              post.id
          );

        const nextPosts =
          [
            post,
            ...withoutExisting,
          ];

        postsRef.current =
          nextPosts;

        hasLoadedRef.current =
          true;

        setPosts(
          nextPosts
        );

        setStatus(
          'ready'
        );

        setErrorMessage(
          null
        );
      },
      []
    );

  const removePost =
    useCallback(
      (
        postId: string
      ) => {
        removedPostIdsRef.current.add(
          postId
        );

        const nextPosts =
          postsRef.current.filter(
            (post) =>
              post.id !==
              postId
          );

        postsRef.current =
          nextPosts;

        setPosts(
          nextPosts
        );
      },
      []
    );

  /*
   * Keep comment counts synchronized
   * between post detail and Home.
   */
  const updatePostCommentCount =
    useCallback(
      (
        postId: string,
        commentCount: number
      ) => {
        const nextPosts =
          postsRef.current.map(
            (post) =>
              post.id ===
              postId
                ? {
                    ...post,
                    commentCount:
                      Math.max(
                        0,
                        commentCount
                      ),
                  }
                : post
          );

        postsRef.current =
          nextPosts;

        setPosts(
          nextPosts
        );
      },
      []
    );

  const updatePostLike =
    useCallback(
      (
        postId: string,
        state: Pick<
          FeedPost,
          | 'isLikedByCurrentUser'
          | 'likeCount'
        >
      ) => {
        const nextPosts =
          postsRef.current.map(
            (post) =>
              post.id ===
              postId
                ? {
                    ...post,
                    ...state,
                  }
                : post
          );

        postsRef.current =
          nextPosts;

        setPosts(
          nextPosts
        );
      },
      []
    );

  const isCurrentUserState =
    stateUserId ===
    userId;

  const value =
    useMemo(
      () => ({
        errorMessage:
          isCurrentUserState
            ? errorMessage
            : null,

        hasMore:
          isCurrentUserState &&
          hasMore,

        isLoadingMore:
          isCurrentUserState &&
          isLoadingMore,

        isRefreshing:
          isCurrentUserState &&
          isRefreshing,

        loadMore,

        posts:
          isCurrentUserState
            ? posts
            : [],

        prependPost,
        refreshFeed,
        removePost,

        status:
          isCurrentUserState
            ? status
            : 'idle',

        updatePostCommentCount,
        updatePostLike,
      }),
      [
        errorMessage,
        hasMore,
        isCurrentUserState,
        isLoadingMore,
        isRefreshing,
        loadMore,
        posts,
        prependPost,
        refreshFeed,
        removePost,
        status,
        updatePostCommentCount,
        updatePostLike,
      ]
    );

  return (
    <FeedContext.Provider
      value={value}
    >
      {children}
    </FeedContext.Provider>
  );
}