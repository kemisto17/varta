import { createContext } from 'react';

import type {
  FeedFilter,
  FeedPost,
} from '../types/post';

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
  filter: FeedFilter;
  hasMore: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;

  loadMore: () => Promise<void>;

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

  setFilter: (
    filter: FeedFilter
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
