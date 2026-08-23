import type { Tables } from './database';

type InstituteRow = Tables<'institutes'>;
type PostRow = Tables<'posts'>;
type ProfileRow = Tables<'profiles'>;

export type FeedPostAuthor = {
  avatarPath: ProfileRow['avatar_path'];
  branch: ProfileRow['branch'];
  fullName: ProfileRow['full_name'];
  id: ProfileRow['id'];
  institute: {
    id: InstituteRow['id'];
    name: InstituteRow['name'];
    shortName: InstituteRow['short_name'];
  };
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
  likeCount: number;
};

export type FeedCursor = Pick<FeedPost, 'createdAt' | 'id'>;
