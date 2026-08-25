import type { Database } from './database';

type ConnectionRow =
  Database['public']['Functions']['get_profile_connections']['Returns'][number];
type FollowedOrganizationRow =
  Database['public']['Functions']['get_followed_organizations_page']['Returns'][number];

export type ProfileConnectionKind = 'followers' | 'following';

export type ProfileConnectionCursor = {
  createdAt: ConnectionRow['created_at'];
  profileId: ConnectionRow['profile_id'];
};

export type ProfileConnection = {
  avatarPath: ConnectionRow['avatar_path'] | null;
  avatarUrl: string | null;
  branch: ConnectionRow['branch'];
  createdAt: ConnectionRow['created_at'];
  fullName: ConnectionRow['full_name'];
  id: ConnectionRow['profile_id'];
  instituteShortName: ConnectionRow['institute_short_name'];
  isFollowedByCurrentUser: ConnectionRow['is_followed_by_current_user'];
  isVerified: ConnectionRow['is_verified'];
  username: ConnectionRow['username'];
  year: ConnectionRow['year'];
};

export type ProfileConnectionPage = {
  connections: ProfileConnection[];
  cursor: ProfileConnectionCursor | null;
  hasMore: boolean;
};

export type FollowedOrganizationCursor = {
  createdAt: FollowedOrganizationRow['created_at'];
  organizationId: FollowedOrganizationRow['organization_id'];
};

export type FollowedOrganization = {
  avatarPath: FollowedOrganizationRow['avatar_path'] | null;
  avatarUrl: string | null;
  campusShortName: FollowedOrganizationRow['campus_short_name'];
  createdAt: FollowedOrganizationRow['created_at'];
  id: FollowedOrganizationRow['organization_id'];
  isVerified: FollowedOrganizationRow['is_verified'];
  name: FollowedOrganizationRow['name'];
};

export type FollowedOrganizationPage = {
  cursor: FollowedOrganizationCursor | null;
  hasMore: boolean;
  organizations: FollowedOrganization[];
};
