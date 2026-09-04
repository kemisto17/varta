import { createContext } from 'react';

import type {
  HomeFeedItem,
  HomeFeedMode,
} from '../types/feed';
import type { FeedPost } from '../types/post';

export type FeedStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export type PostLikeState = Pick<
  FeedPost,
  'isLikedByCurrentUser' | 'likeCount'
>;

export type FeedContextValue = {
  errorMessage: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;

  feedMode: HomeFeedMode;
  setFeedMode: (
    mode: HomeFeedMode
  ) => void;

  loadMore: () => Promise<void>;

  items: HomeFeedItem[];
  posts: FeedPost[];

  prependPost: (
    post: FeedPost
  ) => void;

  refreshFeed: (
    showRefreshState?: boolean
  ) => Promise<void>;

  removePost: (
    postId: string
  ) => void;

  replacePost: (
    post: FeedPost
  ) => void;

  status: FeedStatus;

  updatePostCommentCount: (
    postId: string,
    commentCount: number
  ) => void;

  updatePostLike: (
    postId: string,
    state: PostLikeState
  ) => void;
};

export const FeedContext =
  createContext<
    FeedContextValue | undefined
  >(undefined);
