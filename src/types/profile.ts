import type { Tables } from './database';

type InstituteRow = Tables<'institutes'>;
type ProfileRow = Tables<'profiles'>;

export type UserProfile = {
  avatarPath: ProfileRow['avatar_path'];
  avatarUrl: string | null;
  bio: ProfileRow['bio'];
  branch: ProfileRow['branch'];
  fullName: ProfileRow['full_name'];
  id: ProfileRow['id'];
  institute: {
    id: InstituteRow['id'];
    name: InstituteRow['name'];
    shortName: InstituteRow['short_name'];
  };
  isVerified: boolean;
  postCount: number;
  username: ProfileRow['username'];
  year: ProfileRow['year'];
};
