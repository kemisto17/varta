import type { Tables } from './database';

type OrganizationRow = Tables<'organizations'>;

export type OrganizationRole = 'owner' | 'admin' | 'editor';

export type CampusOrganization = {
  avatarPath: OrganizationRow['avatar_path'];
  description: OrganizationRow['description'];
  id: OrganizationRow['id'];
  instituteId: OrganizationRow['institute_id'];
  isFollowed: boolean;
  isVerified: OrganizationRow['is_verified'];
  name: OrganizationRow['name'];
  role: OrganizationRole | null;
  slug: OrganizationRow['slug'];
  universityId: OrganizationRow['university_id'];
};
