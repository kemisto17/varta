import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { SavedPostsContext } from '../contexts/SavedPostsContext';
import { useAuth } from '../hooks/useAuth';
import { getSavedPostIds, setPostSaved } from '../lib/savedPosts';

export function SavedPostsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const activeUserIdRef = useRef<string | null>(userId);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Set<string>());
  const [stateUserId, setStateUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [pendingPostIds, setPendingPostIds] = useState(new Set<string>());
  const [savedPostIds, setSavedPostIds] = useState(new Set<string>());

  const refreshSavedPosts = useCallback(async () => {
    if (!userId) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const nextSavedPostIds = await getSavedPostIds(userId);

    if (
      requestIdRef.current !== requestId ||
      activeUserIdRef.current !== userId
    ) {
      return;
    }

    setSavedPostIds(nextSavedPostIds);
    setStateUserId(userId);
    setIsReady(true);
  }, [userId]);

  useEffect(() => {
    activeUserIdRef.current = userId;
    requestIdRef.current += 1;
    pendingRef.current = new Set();
    setPendingPostIds(new Set());
    setSavedPostIds(new Set());
    setStateUserId(null);
    setIsReady(false);

    if (!userId) return;

    void refreshSavedPosts().catch((error) => {
      if (activeUserIdRef.current !== userId) return;
      console.warn('[saved-posts] Could not load saved post state.', error);
      setStateUserId(userId);
      setIsReady(true);
    });
  }, [refreshSavedPosts, userId]);

  const toggleSavedPost = useCallback(async (postId: string) => {
    if (!userId || !isReady || pendingRef.current.has(postId)) {
      return savedPostIds.has(postId);
    }

    const wasSaved = savedPostIds.has(postId);
    const nextSaved = !wasSaved;
    pendingRef.current.add(postId);
    setPendingPostIds((current) => new Set(current).add(postId));
    setSavedPostIds((current) => {
      const next = new Set(current);
      if (nextSaved) next.add(postId);
      else next.delete(postId);
      return next;
    });

    try {
      await setPostSaved({ isSaved: nextSaved, postId, userId });
      return nextSaved;
    } catch (error) {
      if (activeUserIdRef.current === userId) {
        setSavedPostIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(postId);
          else next.delete(postId);
          return next;
        });
      }
      throw error;
    } finally {
      if (activeUserIdRef.current === userId) {
        pendingRef.current.delete(postId);
        setPendingPostIds((current) => {
          const next = new Set(current);
          next.delete(postId);
          return next;
        });
      }
    }
  }, [isReady, savedPostIds, userId]);

  const value = useMemo(() => ({
    isReady: stateUserId === userId && isReady,
    pendingPostIds,
    refreshSavedPosts,
    savedPostIds: stateUserId === userId ? savedPostIds : new Set<string>(),
    toggleSavedPost,
  }), [
    isReady,
    pendingPostIds,
    refreshSavedPosts,
    savedPostIds,
    stateUserId,
    toggleSavedPost,
    userId,
  ]);

  return (
    <SavedPostsContext.Provider value={value}>
      {children}
    </SavedPostsContext.Provider>
  );
}
