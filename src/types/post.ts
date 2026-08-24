import type { Tables } from './database';
import type { ProfileBadge } from './badge';

type InstituteRow = Tables<'institutes'>;
type CommentRow = Tables<'comments'>;
type PostRow = Tables<'posts'>;
type ProfileRow = Tables<'profiles'>;

export type FeedPostAuthor = {
  avatarPath: ProfileRow['avatar_path'];
  avatarUrl: string | null;
  branch: ProfileRow['branch'];
  fullName: ProfileRow['full_name'];
  id: ProfileRow['id'];
  institute: {
    id: InstituteRow['id'];
    name: InstituteRow['name'];
    shortName: InstituteRow['short_name'];
  };
  isVerified: boolean;
  primaryBadge: ProfileBadge | null;
  username: ProfileRow['username'];
  year: ProfileRow['year'];
};

export type FeedPost = {
  author: FeedPostAuthor;
  authorId: PostRow['author_id'];
  commentCount: number;
  content: PostRow['content'];
  createdAt: PostRow['created_at'];
  id: PostRow['id'];
  imagePath: PostRow['image_path'];
  imageUrl: string | null;
  isLikedByCurrentUser: boolean;
  likeCount: number;
};

export type FeedCursor = Pick<FeedPost, 'createdAt' | 'id'>;

export type PostComment = {
  author: Pick<
    FeedPostAuthor,
    | 'avatarPath'
    | 'avatarUrl'
    | 'branch'
    | 'fullName'
    | 'id'
    | 'isVerified'
    | 'year'
  >;
  authorId: CommentRow['author_id'];
  content: CommentRow['content'];
  createdAt: CommentRow['created_at'];
  id: CommentRow['id'];
  postId: CommentRow['post_id'];
};
