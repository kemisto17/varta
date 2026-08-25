import { getAvatarUrls } from './avatars';
import { getOrganizationAvatarUrls } from './organizations';
import { supabase } from './supabase';
import type {
  FollowedOrganization,
  FollowedOrganizationCursor,
  FollowedOrganizationPage,
  ProfileConnection,
  ProfileConnectionCursor,
  ProfileConnectionKind,
  ProfileConnectionPage,
} from '../types/profileFollow';

export const CONNECTION_PAGE_SIZE = 24;

export async function setProfileFollow({
  followerId,
  followingId,
  isFollowed,
}: {
  followerId: string;
  followingId: string;
  isFollowed: boolean;
}) {
  if (followerId === followingId) {
    throw new Error('You cannot follow your own profile.');
  }

  const query = isFollowed
    ? supabase.from('profile_follows').insert({
        follower_id: followerId,
        following_id: followingId,
      })
    : supabase
        .from('profile_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
  const { error } = await query;

  if (error && !(isFollowed && error.code === '23505')) {
    throw error;
  }
}

export async function getProfileConnectionsPage({
  cursor = null,
  kind,
  profileId,
}: {
  cursor?: ProfileConnectionCursor | null;
  kind: ProfileConnectionKind;
  profileId: string;
}): Promise<ProfileConnectionPage> {
  const { data, error } = await supabase.rpc('get_profile_connections', {
    connection_kind: kind,
    ...(cursor
      ? {
          cursor_created_at: cursor.createdAt,
          cursor_profile_id: cursor.profileId,
        }
      : {}),
    result_limit: CONNECTION_PAGE_SIZE + 1,
    target_profile_id: profileId,
  });

  if (error) {
    throw error;
  }

  const hasMore = data.length > CONNECTION_PAGE_SIZE;
  const rows = data.slice(0, CONNECTION_PAGE_SIZE);
  const avatarUrls = await getSafeAvatarUrls(
    rows.flatMap((row) => (row.avatar_path ? [row.avatar_path] : []))
  );
  const connections = rows.map(
    (row): ProfileConnection => ({
      avatarPath: row.avatar_path || null,
      avatarUrl: row.avatar_path
        ? (avatarUrls.get(row.avatar_path) ?? null)
        : null,
      branch: row.branch,
      createdAt: row.created_at,
      fullName: row.full_name,
      id: row.profile_id,
      instituteShortName: row.institute_short_name,
      isFollowedByCurrentUser: row.is_followed_by_current_user,
      isVerified: row.is_verified,
      username: row.username,
      year: row.year,
    })
  );
  const lastConnection = connections.at(-1);

  return {
    connections,
    cursor: lastConnection
      ? {
          createdAt: lastConnection.createdAt,
          profileId: lastConnection.id,
        }
      : null,
    hasMore,
  };
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
      result_limit: CONNECTION_PAGE_SIZE + 1,
    }
  );

  if (error) {
    throw error;
  }

  const hasMore = data.length > CONNECTION_PAGE_SIZE;
  const rows = data.slice(0, CONNECTION_PAGE_SIZE);
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

export function getProfileFollowErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('own profile')) {
    return error.message;
  }

  if (isPostgrestError(error, '42501')) {
    return 'This follow is unavailable. The profile may be blocked or outside your university.';
  }

  return 'We could not update this follow. Check your connection and try again.';
}

function isPostgrestError(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String(error.code) === code
  );
}

async function getSafeAvatarUrls(paths: string[]) {
  try {
    return await getAvatarUrls([...new Set(paths)]);
  } catch (error) {
    console.warn('[profile-follows] Could not load student avatars.', error);
    return new Map<string, string>();
  }
}

async function getSafeOrganizationAvatarUrls(paths: string[]) {
  try {
    return await getOrganizationAvatarUrls([...new Set(paths)]);
  } catch (error) {
    console.warn('[profile-follows] Could not load organization images.', error);
    return new Map<string, string>();
  }
}
