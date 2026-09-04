import { EventCard } from '../events/EventCard';
import { LostFoundFeedCard } from '../lost-found/LostFoundFeedCard';
import { PostCard } from '../PostCard';

import type { ModerationUser, ReportTarget } from '../../lib/moderation';
import type { CampusEvent } from '../../types/event';
import type { HomeFeedItem } from '../../types/feed';
import type { FeedPost } from '../../types/post';

type FeedItemRendererProps = {
  currentUserId: string | null;
  eventInterestPendingIds: Set<string>;
  item: HomeFeedItem;
  likePendingIds: Set<string>;
  deletingPostIds: Set<string>;
  onAuthorPress: (post: FeedPost) => void;
  onBlockUser: (user: ModerationUser) => void;
  onDeletePost: (post: FeedPost) => void;
  onEditPost: (post: FeedPost) => void;
  onEventPress: (event: CampusEvent) => void;
  onLostFoundPress: (id: string) => void;
  onMentionPress: (username: string) => void;
  onOpenPost: (post: FeedPost) => void;
  onReport: (target: ReportTarget) => void;
  onToggleEventInterest: (event: CampusEvent) => void;
  onTogglePostLike: (post: FeedPost) => void;
};

export function FeedItemRenderer({
  currentUserId,
  deletingPostIds,
  eventInterestPendingIds,
  item,
  likePendingIds,
  onAuthorPress,
  onBlockUser,
  onDeletePost,
  onEditPost,
  onEventPress,
  onLostFoundPress,
  onMentionPress,
  onOpenPost,
  onReport,
  onToggleEventInterest,
  onTogglePostLike,
}: FeedItemRendererProps) {
  switch (item.itemType) {
    case 'post':
      return (
        <PostCard
          currentUserId={currentUserId}
          isDeleting={deletingPostIds.has(item.post.id)}
          isLikePending={likePendingIds.has(item.post.id)}
          onAuthorPress={onAuthorPress}
          onBlockUser={(post) =>
            post.author.kind === 'student' && post.authorId
              ? onBlockUser({
                  fullName: post.author.fullName,
                  id: post.authorId,
                })
              : undefined
          }
          onCommentPress={onOpenPost}
          onDelete={onDeletePost}
          onEdit={onEditPost}
          onMentionPress={onMentionPress}
          onOpenPost={onOpenPost}
          onReport={(post) =>
            onReport({
              id: post.id,
              label: 'Report this post',
              type: 'post',
            })
          }
          onToggleLike={onTogglePostLike}
          post={item.post}
        />
      );

    case 'event':
      return (
        <EventCard
          event={item.event}
          interestPending={eventInterestPendingIds.has(item.event.id)}
          onInterestToggle={onToggleEventInterest}
          onPress={onEventPress}
        />
      );

    case 'lost_found':
      return (
        <LostFoundFeedCard
          item={item.item}
          onPress={() => onLostFoundPress(item.item.id)}
        />
      );

    case 'announcement':
    case 'opportunity':
      return null;
  }
}
