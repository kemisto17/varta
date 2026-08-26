import type { QueryData } from '@supabase/supabase-js';

import type {
  CampusOrganization,
  FollowedOrganization,
  FollowedOrganizationCursor,
  FollowedOrganizationPage,
  OrganizationRole,
} from '../types/organization';
import { createPrivateImageUrl, createPrivateImageUrls } from './storage';
import { supabase } from './supabase';

export const ORGANIZATION_MEDIA_BUCKET = 'organization-media';
export const FOLLOWED_ORGANIZATIONS_PAGE_SIZE = 24;

const ORGANIZATION_SELECT = `
  id,
  university_id,
  institute_id,
  name,
  slug,
  description,
  avatar_path,
  is_verified,
  institute:institutes!organizations_institute_id_fkey (
    short_name
  ),
  university:universities!organizations_university_id_fkey (
    short_name
  )
` as const;

function selectOrganizations() {
  return supabase.from('organizations').select(ORGANIZATION_SELECT);
}

type OrganizationQueryRow = QueryData<
  ReturnType<typeof selectOrganizations>
>[number];

export async function getOrganizationById(
  organizationId: string,
  userId: string
): Promise<CampusOrganization | null> {
  const { data: organization, error } = await selectOrganizations()
    .eq('id', organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!organization) {
    return null;
  }

  const [
    { data: membership, error: roleError },
    { data: follow, error: followError },
    { data: summary, error: summaryError },
    avatarUrl,
  ] = await Promise.all([
      supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('organization_follows')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .rpc('get_organization_profile_summary', {
          target_organization_id: organizationId,
        })
        .maybeSingle(),
      getOrganizationAvatarUrl(organization.avatar_path),
    ]);

  if (roleError) {
    throw roleError;
  }

  if (followError) {
    throw followError;
  }

  if (summaryError) {
    throw summaryError;
  }

  if (!summary) {
    return null;
  }

  return {
    avatarPath: organization.avatar_path,
    avatarUrl,
    campusShortName: getOrganizationCampusShortName(organization),
    description: organization.description,
    eventCount: summary.event_count,
    followerCount: summary.follower_count,
    id: organization.id,
    instituteId: organization.institute_id,
    isFollowed: follow !== null,
    isVerified: organization.is_verified,
    name: organization.name,
    // Organization-authored posts are not yet represented in the current
    // posts schema. Keep the profile stat honest instead of counting members'
    // personal posts as official organization content.
    postCount: 0,
    role: toOrganizationRole(membership?.role),
    slug: organization.slug,
    universityId: organization.university_id,
  };
}

export function getOrganizationAvatarUrls(paths: string[]) {
  return createPrivateImageUrls(ORGANIZATION_MEDIA_BUCKET, paths);
}

async function getOrganizationAvatarUrl(path: string | null) {
  if (!path) {
    return null;
  }

  try {
    return await createPrivateImageUrl(ORGANIZATION_MEDIA_BUCKET, path);
  } catch (error) {
    console.warn('[organization] Could not load organization image.', error);
    return null;
  }
}

export async function setOrganizationFollow({
  isFollowed,
  organizationId,
  userId,
}: {
  isFollowed: boolean;
  organizationId: string;
  userId: string;
}) {
  const query = isFollowed
    ? supabase
        .from('organization_follows')
        .insert({ organization_id: organizationId, user_id: userId })
    : supabase
        .from('organization_follows')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId);
  const { error } = await query;

  if (error) {
    throw error;
  }
}

export async function getFollowedOrganizationIds(userId: string) {
  const { data, error } = await supabase
    .from('organization_follows')
    .select('organization_id')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return data.map((follow) => follow.organization_id);
}

export async function getFollowedOrganizationsPage(
  cursor: FollowedOrganizationCursor | null = null
): Promise<FollowedOrganizationPage> {
  const { data, error } = await supabase.rpc(
    'get_followed_organizations_page',
    {
      ...(cursor
        ? {
            cursor_created_at: cursor.createdAt,
            cursor_organization_id: cursor.organizationId,
          }
        : {}),
      result_limit: FOLLOWED_ORGANIZATIONS_PAGE_SIZE + 1,
    }
  );

  if (error) {
    throw error;
  }

  const hasMore = data.length > FOLLOWED_ORGANIZATIONS_PAGE_SIZE;
  const rows = data.slice(0, FOLLOWED_ORGANIZATIONS_PAGE_SIZE);
  const avatarUrls = await getSafeOrganizationAvatarUrls(
    rows.flatMap((row) => (row.avatar_path ? [row.avatar_path] : []))
  );
  const organizations = rows.map(
    (row): FollowedOrganization => ({
      avatarPath: row.avatar_path || null,
      avatarUrl: row.avatar_path
        ? (avatarUrls.get(row.avatar_path) ?? null)
        : null,
      campusShortName: row.campus_short_name,
      createdAt: row.created_at,
      id: row.organization_id,
      isVerified: row.is_verified,
      name: row.name,
    })
  );
  const lastOrganization = organizations.at(-1);

  return {
    cursor: lastOrganization
      ? {
          createdAt: lastOrganization.createdAt,
          organizationId: lastOrganization.id,
        }
      : null,
    hasMore,
    organizations,
  };
}

export function isOrganizationManagerRole(
  role: OrganizationRole | null
): role is OrganizationRole {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

export function canEditOrganizationEvent(
  role: OrganizationRole | null,
  eventCreatorId: string,
  userId: string
) {
  return (
    role === 'owner' ||
    role === 'admin' ||
    (role === 'editor' && eventCreatorId === userId)
  );
}

export function getOrganizationErrorMessage() {
  return 'We could not load this organization. Check your connection and try again.';
}

function toOrganizationRole(value: string | undefined): OrganizationRole | null {
  return value === 'owner' || value === 'admin' || value === 'editor'
    ? value
    : null;
}

function getOrganizationCampusShortName(row: OrganizationQueryRow) {
  return row.institute?.short_name ?? row.university?.short_name ?? 'Campus';
}

async function getSafeOrganizationAvatarUrls(paths: string[]) {
  try {
    return await getOrganizationAvatarUrls([...new Set(paths)]);
  } catch (error) {
    console.warn('[organizations] Could not load organization images.', error);
    return new Map<string, string>();
  }
}
