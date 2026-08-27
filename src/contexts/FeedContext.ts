import { createContext } from 'react';

import type { FeedPost } from '../types/post';

export type FeedStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PostLikeState = Pick<
  FeedPost,
  'isLikedByCurrentUser' | 'likeCount'
>;

export type FeedContextValue = {
  errorMessage: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  loadMore: () => Promise<void>;
  posts: FeedPost[];
  refreshFeed: (showRefreshState?: boolean) => Promise<void>;
  removePost: (postId: string) => void;
  status: FeedStatus;
  updatePostLike: (postId: string, state: PostLikeState) => void;
};

export const FeedContext = createContext<FeedContextValue | undefined>(
  undefined
);
