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
import { getHomeFeedPage } from '../lib/feed';
import type {
  HomeFeedCursor,
  HomeFeedItem,
  HomeFeedMode,
  HomePostFeedItem,
} from '../types/feed';
import type {
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
    useRef<HomeFeedItem[]>([]);

  const cursorRef =
    useRef<HomeFeedCursor | null>(
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
    feedMode,
    setFeedModeState,
  ] =
    useState<HomeFeedMode>(
      'campus'
    );

  const [
    items,
    setItems,
  ] =
    useState<
      HomeFeedItem[]
    >([]);

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

    setItems([]);
    setPosts([]);
    setHasMore(true);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setErrorMessage(null);
    setStatus('idle');
  }, [feedMode, userId]);

  const setFeedMode =
    useCallback(
      (
        nextMode: HomeFeedMode
      ) => {
        setFeedModeState(
          nextMode
        );
      },
      []
    );

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
            await getHomeFeedPage({
              cursor: null,
              mode: feedMode,
              userId,
            });

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          const visibleItems =
            page.items.filter(
              (item) =>
                item.itemType !==
                  'post' ||
                !removedPostIdsRef.current.has(
                  item.post.id
                )
            );

          postsRef.current =
            visibleItems;

          cursorRef.current =
            page.cursor;

          hasMoreRef.current =
            page.hasMore;

          hasLoadedRef.current =
            true;

          setStateUserId(
            userId
          );

          setItems(
            visibleItems
          );

          setPosts(
            getPostItems(
              visibleItems
            ).map(
              (item) => item.post
            )
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
      [feedMode, userId]
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
            await getHomeFeedPage({
              cursor:
                cursorRef.current,
              mode: feedMode,
              userId,
            });

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          const existingIds =
            new Set(
              postsRef.current.map(
                (item) =>
                  item.feedKey
              )
            );

          const newItems =
            page.items.filter(
              (item) =>
                !existingIds.has(
                  item.feedKey
                ) &&
                (
                  item.itemType !==
                    'post' ||
                  !removedPostIdsRef.current.has(
                    item.post.id
                  )
                )
            );

          const nextItems =
            [
              ...postsRef.current,
              ...newItems,
            ];

          postsRef.current =
            nextItems;

          cursorRef.current =
            page.cursor;

          hasMoreRef.current =
            page.hasMore;

          setItems(
            nextItems
          );

          setPosts(
            getPostItems(
              nextItems
            ).map(
              (item) => item.post
            )
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
            typeof error === 'object' && error !== null &&
            'message' in error && error.message === 'Feed session expired. Pull to refresh.'
              ? 'Your feed session expired. Pull down to refresh.'
              : 'We could not load more posts. Please try again.'
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
      [feedMode, userId]
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
        if (post.postKind !== 'general') {
          return;
        }

        removedPostIdsRef.current.delete(
          post.id
        );

        const feedItem: HomePostFeedItem =
          {
            createdAt:
              post.createdAt,
            feedKey:
              `post:${post.id}`,
            itemType:
              'post',
            post,
            score: null,
          };

        const withoutExisting =
          postsRef.current.filter(
            (existingItem) =>
              existingItem.feedKey !==
              feedItem.feedKey
          );

        const nextItems =
          [
            feedItem,
            ...withoutExisting,
          ];

        postsRef.current =
          nextItems;

        hasLoadedRef.current =
          true;

        setItems(
          nextItems
        );

        setPosts(
          getPostItems(
            nextItems
          ).map(
            (item) => item.post
          )
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

  const replacePost =
    useCallback(
      (
        post: FeedPost
      ) => {
        const nextItems: HomeFeedItem[] =
          postsRef.current.flatMap(
            (
              existingItem
            ): HomeFeedItem[] => {
              if (
                existingItem.itemType !==
                'post'
              ) {
                return [
                  existingItem,
                ];
              }

              if (
                existingItem.post.id !==
                post.id
              ) {
                return [
                  existingItem,
                ];
              }

              return post.postKind ===
                'general'
                ? [
                    {
                      ...existingItem,
                      post,
                    },
                  ]
                : [];
            }
          );

        postsRef.current =
          nextItems;
        setItems(nextItems);
        setPosts(
          getPostItems(nextItems).map(
            (item) => item.post
          )
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
            (item) =>
              item.itemType !==
                'post' ||
              item.post.id !==
                postId
          );

        postsRef.current =
          nextPosts;

        setItems(
          nextPosts
        );

        setPosts(
          getPostItems(nextPosts).map(
            (item) => item.post
          )
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
            (item) =>
              item.itemType ===
                'post' &&
              item.post.id ===
              postId
                ? {
                    ...item,
                    post: {
                      ...item.post,
                      commentCount:
                        Math.max(
                          0,
                          commentCount
                        ),
                    },
                  }
                : item
          );

        postsRef.current =
          nextPosts;

        setItems(
          nextPosts
        );

        setPosts(
          getPostItems(nextPosts).map(
            (item) => item.post
          )
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
            (item) =>
              item.itemType ===
                'post' &&
              item.post.id ===
              postId
                ? {
                    ...item,
                    post: {
                      ...item.post,
                      ...state,
                    },
                  }
                : item
          );

        postsRef.current =
          nextPosts;

        setItems(
          nextPosts
        );

        setPosts(
          getPostItems(nextPosts).map(
            (item) => item.post
          )
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

        feedMode,

        isLoadingMore:
          isCurrentUserState &&
          isLoadingMore,

        isRefreshing:
          isCurrentUserState &&
          isRefreshing,

        loadMore,

        items:
          isCurrentUserState
            ? items
            : [],

        posts:
          isCurrentUserState
            ? posts
            : [],

        prependPost,
        refreshFeed,
        removePost,
        replacePost,
        setFeedMode,

        status:
          isCurrentUserState
            ? status
            : 'idle',

        updatePostCommentCount,
        updatePostLike,
      }),
      [
        errorMessage,
        feedMode,
        hasMore,
        items,
        isCurrentUserState,
        isLoadingMore,
        isRefreshing,
        loadMore,
        posts,
        prependPost,
        refreshFeed,
        removePost,
        replacePost,
        setFeedMode,
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

function getPostItems(
  items: HomeFeedItem[]
) {
  return items.filter(
    (
      item
    ): item is HomePostFeedItem =>
      item.itemType === 'post'
  );
}
