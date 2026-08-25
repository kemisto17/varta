import type { Tables } from './database';
import type { ProfileBadge } from './badge';

type InstituteRow = Tables<'institutes'>;
type ProfileRow = Tables<'profiles'>;

export type UserProfile = {
  avatarPath: ProfileRow['avatar_path'];
  avatarUrl: string | null;
  badges: ProfileBadge[];
  bio: ProfileRow['bio'];
  branch: ProfileRow['branch'];
  fullName: ProfileRow['full_name'];
  id: ProfileRow['id'];
  institute: {
    id: InstituteRow['id'];
    name: InstituteRow['name'];
    shortName: InstituteRow['short_name'];
  };
  followerCount: number;
  followingCount: number;
  isFollowedByCurrentUser: boolean;
  isVerified: boolean;
  postCount: number;
  username: ProfileRow['username'];
  year: ProfileRow['year'];
};
