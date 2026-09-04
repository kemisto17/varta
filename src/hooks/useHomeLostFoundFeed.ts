import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getLostFoundErrorMessage,
  getLostFoundPage,
} from '../lib/lostFound';
import type {
  LostFoundCursor,
  LostFoundItem,
} from '../types/lostFound';

type HomeLostFoundStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useHomeLostFoundFeed(userId: string | null) {
  const activeUserIdRef = useRef(userId);
  const cursorRef = useRef<LostFoundCursor | null>(null);
  const hasMoreRef = useRef(true);
  const itemsRef = useRef<LostFoundItem[]>([]);
  const loadMorePendingRef = useRef(false);
  const requestIdRef = useRef(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [status, setStatus] = useState<HomeLostFoundStatus>('idle');

  useEffect(() => {
    activeUserIdRef.current = userId;
    requestIdRef.current += 1;
    cursorRef.current = null;
    hasMoreRef.current = true;
    itemsRef.current = [];
    loadMorePendingRef.current = false;

    setErrorMessage(null);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsRefreshing(false);
    setItems([]);
    setStatus('idle');
  }, [userId]);

  const refresh = useCallback(
    async (showRefreshState = false) => {
      if (!userId) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setErrorMessage(null);

      if (showRefreshState) {
        setIsRefreshing(true);
      } else if (itemsRef.current.length === 0) {
        setStatus('loading');
      }

      try {
        const page = await getLostFoundPage(userId, 'all');

        if (
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        cursorRef.current = page.cursor;
        hasMoreRef.current = page.hasMore;
        itemsRef.current = page.items;

        setHasMore(page.hasMore);
        setItems(page.items);
        setStatus('ready');
      } catch (error) {
        if (
          requestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        console.warn('[home-lost-found] Could not load listings.', error);
        cursorRef.current = null;
        hasMoreRef.current = false;
        setErrorMessage(getLostFoundErrorMessage(error));
        setHasMore(false);
        setStatus(itemsRef.current.length > 0 ? 'ready' : 'error');
      } finally {
        if (
          requestIdRef.current === requestId &&
          activeUserIdRef.current === userId
        ) {
          setIsRefreshing(false);
        }
      }
    },
    [userId]
  );

  const loadMore = useCallback(async () => {
    if (
      !userId ||
      !hasMoreRef.current ||
      loadMorePendingRef.current ||
      !cursorRef.current
    ) {
      return;
    }

    const requestId = requestIdRef.current;
    loadMorePendingRef.current = true;
    setIsLoadingMore(true);

    try {
      const page = await getLostFoundPage(userId, 'all', cursorRef.current);

      if (
        requestIdRef.current !== requestId ||
        activeUserIdRef.current !== userId
      ) {
        return;
      }

      const knownIds = new Set(itemsRef.current.map((item) => item.id));
      const nextItems = [
        ...itemsRef.current,
        ...page.items.filter((item) => !knownIds.has(item.id)),
      ];

      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      itemsRef.current = nextItems;

      setErrorMessage(null);
      setHasMore(page.hasMore);
      setItems(nextItems);
    } catch (error) {
      if (
        requestIdRef.current === requestId &&
        activeUserIdRef.current === userId
      ) {
        console.warn('[home-lost-found] Could not load more listings.', error);
        setErrorMessage(getLostFoundErrorMessage(error));
      }
    } finally {
      if (activeUserIdRef.current === userId) {
        loadMorePendingRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [userId]);

  return {
    errorMessage,
    hasMore,
    isLoadingMore,
    isRefreshing,
    items,
    loadMore,
    refresh,
    status,
  };
}
