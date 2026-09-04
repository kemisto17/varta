import type { CampusEvent } from './event';
import type { LostFoundItem } from './lostFound';
import type { FeedPost } from './post';

export type HomeFeedMode = 'campus' | 'latest';

export type HomeFeedItemType =
  | 'post'
  | 'event'
  | 'lost_found'
  | 'announcement'
  | 'opportunity';

export type HomeFeedCursor =
  | { mode: 'latest'; createdAt: string; id: string }
  | { mode: 'campus'; snapshotId: string; position: number };

export type HomePostFeedItem = {
  createdAt: string;
  feedKey: string;
  itemType: 'post';
  post: FeedPost;
  score: number | null;
};

export type HomeEventFeedItem = {
  createdAt: string;
  event: CampusEvent;
  feedKey: string;
  itemType: 'event';
  score: number | null;
};

export type HomeLostFoundFeedItem = {
  createdAt: string;
  feedKey: string;
  item: LostFoundItem;
  itemType: 'lost_found';
  score: number | null;
};

export type HomePreparedFeedItem = {
  createdAt: string;
  feedKey: string;
  id: string;
  itemType: 'announcement' | 'opportunity';
  score: number | null;
};

export type HomeFeedItem =
  | HomePostFeedItem
  | HomeEventFeedItem
  | HomeLostFoundFeedItem
  | HomePreparedFeedItem;

export type HomeFeedPage = {
  cursor: HomeFeedCursor | null;
  hasMore: boolean;
  items: HomeFeedItem[];
};
