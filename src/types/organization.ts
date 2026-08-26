import type { Database, Tables } from './database';

type OrganizationRow = Tables<'organizations'>;
type FollowedOrganizationRow =
  Database['public']['Functions']['get_followed_organizations_page']['Returns'][number];

export type OrganizationRole = 'owner' | 'admin' | 'editor';

export type CampusOrganization = {
  avatarPath: OrganizationRow['avatar_path'];
  avatarUrl: string | null;
  campusShortName: string;
  description: OrganizationRow['description'];
  eventCount: number;
  followerCount: number;
  id: OrganizationRow['id'];
  instituteId: OrganizationRow['institute_id'];
  isFollowed: boolean;
  isVerified: OrganizationRow['is_verified'];
  name: OrganizationRow['name'];
  postCount: number;
  role: OrganizationRole | null;
  slug: OrganizationRow['slug'];
  universityId: OrganizationRow['university_id'];
};

export type FollowedOrganizationCursor = {
  createdAt: FollowedOrganizationRow['created_at'];
  organizationId: FollowedOrganizationRow['organization_id'];
};

export type FollowedOrganization = {
  avatarPath: string | null;
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
