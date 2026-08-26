import type { Tables } from './database';
import type { ProfileBadge } from './badge';

type InstituteRow = Tables<'institutes'>;
type CommentRow = Tables<'comments'>;
type PostRow = Tables<'posts'>;
type ProfileRow = Tables<'profiles'>;

export type FeedPostStudentAuthor = {
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
  kind: 'student';
  primaryBadge: ProfileBadge | null;
  username: ProfileRow['username'];
  year: ProfileRow['year'];
};

export type FeedPostOrganizationAuthor = {
  avatarPath: string | null;
  avatarUrl: string | null;
  campusShortName: string;
  fullName: string;
  id: string;
  isVerified: boolean;
  kind: 'organization';
  primaryBadge: null;
};

export type FeedPostAuthor =
  | FeedPostStudentAuthor
  | FeedPostOrganizationAuthor;

export type FeedPost = {
  author: FeedPostAuthor;
  authorId: PostRow['author_id'];
  canDeleteByCurrentUser: boolean;
  commentCount: number;
  content: PostRow['content'];
  createdAt: PostRow['created_at'];
  id: PostRow['id'];
  imagePath: PostRow['image_path'];
  imageUrl: string | null;
  isLikedByCurrentUser: boolean;
  likeCount: number;
  organizationAuthorId: PostRow['organization_author_id'];
};

export type FeedCursor = Pick<FeedPost, 'createdAt' | 'id'>;

export type PostComment = {
  author: Pick<
    FeedPostStudentAuthor,
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
