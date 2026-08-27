import type { QueryData } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { TablesUpdate } from '../types/database';
import type {
  CampusOrganization,
  FollowedOrganization,
  FollowedOrganizationCursor,
  FollowedOrganizationPage,
  ManageableOrganization,
  OrganizationRole,
} from '../types/organization';
import { optimizeAvatarAsset } from './imageOptimization';
import {
  deleteOrganizationAvatarFromR2,
  uploadOrganizationAvatarToR2,
} from './r2';
import {
  createPrivateImageUrl,
  createPrivateImageUrls,
  isImageUploadError,
} from './storage';
import { supabase } from './supabase';

export const ORGANIZATION_MEDIA_BUCKET = 'organization-media';
export const FOLLOWED_ORGANIZATIONS_PAGE_SIZE = 24;

export const MAX_ORGANIZATION_AVATAR_SIZE =
  5 * 1024 * 1024;

export const MAX_ORGANIZATION_DESCRIPTION_CHARACTERS =
  500;

const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_BASE_URL
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '') ?? '';

const ORGANIZATION_R2_AVATAR_PREFIX =
  'avatars/organizations/';

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
  return supabase
    .from('organizations')
    .select(ORGANIZATION_SELECT);
}

type OrganizationQueryRow = QueryData<
  ReturnType<typeof selectOrganizations>
>[number];

export type UpdateOrganizationProfileInput = {
  asset: ImagePickerAsset | null;
  currentAvatarPath: string | null;
  description: string;
  name: string;
  organizationId: string;
  removeAvatar: boolean;
  role: OrganizationRole | null;
};

export async function getOrganizationById(
  organizationId: string,
  userId: string
): Promise<CampusOrganization | null> {
  const { data: organization, error } =
    await selectOrganizations()
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
        target_organization_id:
          organizationId,
      })
      .maybeSingle(),

    getOrganizationAvatarUrl(
      organization.avatar_path
    ),
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
    avatarPath:
      organization.avatar_path,
    avatarUrl,
    campusShortName:
      getOrganizationCampusShortName(
        organization
      ),
    description:
      organization.description,
    eventCount:
      summary.event_count,
    followerCount:
      summary.follower_count,
    id:
      organization.id,
    instituteId:
      organization.institute_id,
    isFollowed:
      follow !== null,
    isVerified:
      organization.is_verified,
    name:
      organization.name,
    postCount:
      summary.post_count,
    role:
      toOrganizationRole(
        membership?.role
      ),
    slug:
      organization.slug,
    universityId:
      organization.university_id,
  };
}

export async function getOrganizationAvatarUrls(
  paths: string[]
) {
  const urls =
    new Map<string, string>();

  const uniquePaths = [
    ...new Set(paths),
  ];

  const r2Paths =
    uniquePaths.filter(
      isR2OrganizationAvatarPath
    );

  const legacyPaths =
    uniquePaths.filter(
      (path) =>
        !isR2OrganizationAvatarPath(
          path
        )
    );

  for (const path of r2Paths) {
    try {
      urls.set(
        path,
        getR2OrganizationAvatarUrl(
          path
        )
      );
    } catch (error) {
      console.warn(
        '[organization] Could not build R2 avatar URL.',
        error
      );
    }
  }

  if (legacyPaths.length > 0) {
    try {
      const legacyUrls =
        await createPrivateImageUrls(
          ORGANIZATION_MEDIA_BUCKET,
          legacyPaths
        );

      for (const [
        path,
        url,
      ] of legacyUrls) {
        urls.set(path, url);
      }
    } catch (error) {
      console.warn(
        '[organization] Could not load legacy organization avatars.',
        error
      );
    }
  }

  return urls;
}

async function getOrganizationAvatarUrl(
  path: string | null
) {
  if (!path) {
    return null;
  }

  try {
    if (
      isR2OrganizationAvatarPath(
        path
      )
    ) {
      return getR2OrganizationAvatarUrl(
        path
      );
    }

    return await createPrivateImageUrl(
      ORGANIZATION_MEDIA_BUCKET,
      path
    );
  } catch (error) {
    console.warn(
      '[organization] Could not load organization image.',
      error
    );

    return null;
  }
}

function isR2OrganizationAvatarPath(
  path: string
) {
  return path.startsWith(
    ORGANIZATION_R2_AVATAR_PREFIX
  );
}

function getR2OrganizationAvatarUrl(
  path: string
) {
  if (!MEDIA_BASE_URL) {
    throw new Error(
      'Missing EXPO_PUBLIC_MEDIA_BASE_URL.'
    );
  }

  const cleanPath = path
    .trim()
    .replace(/^\/+/, '');

  return `${MEDIA_BASE_URL}/${cleanPath}`;
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
        .insert({
          organization_id:
            organizationId,
          user_id:
            userId,
        })
    : supabase
        .from('organization_follows')
        .delete()
        .eq(
          'organization_id',
          organizationId
        )
        .eq(
          'user_id',
          userId
        );

  const { error } = await query;

  if (error) {
    throw error;
  }
}

export async function getFollowedOrganizationIds(
  userId: string
) {
  const { data, error } =
    await supabase
      .from(
        'organization_follows'
      )
      .select(
        'organization_id'
      )
      .eq(
        'user_id',
        userId
      );

  if (error) {
    throw error;
  }

  return data.map(
    (follow) =>
      follow.organization_id
  );
}

export async function getFollowedOrganizationsPage(
  cursor: FollowedOrganizationCursor | null = null
): Promise<FollowedOrganizationPage> {
  const { data, error } =
    await supabase.rpc(
      'get_followed_organizations_page',
      {
        ...(cursor
          ? {
              cursor_created_at:
                cursor.createdAt,
              cursor_organization_id:
                cursor.organizationId,
            }
          : {}),
        result_limit:
          FOLLOWED_ORGANIZATIONS_PAGE_SIZE +
          1,
      }
    );

  if (error) {
    throw error;
  }

  const hasMore =
    data.length >
    FOLLOWED_ORGANIZATIONS_PAGE_SIZE;

  const rows = data.slice(
    0,
    FOLLOWED_ORGANIZATIONS_PAGE_SIZE
  );

  const avatarUrls =
    await getSafeOrganizationAvatarUrls(
      rows.flatMap((row) =>
        row.avatar_path
          ? [row.avatar_path]
          : []
      )
    );

  const organizations =
    rows.map(
      (
        row
      ): FollowedOrganization => ({
        avatarPath:
          row.avatar_path || null,
        avatarUrl:
          row.avatar_path
            ? avatarUrls.get(
                row.avatar_path
              ) ?? null
            : null,
        campusShortName:
          row.campus_short_name,
        createdAt:
          row.created_at,
        id:
          row.organization_id,
        isVerified:
          row.is_verified,
        name:
          row.name,
      })
    );

  const lastOrganization =
    organizations.at(-1);

  return {
    cursor: lastOrganization
      ? {
          createdAt:
            lastOrganization.createdAt,
          organizationId:
            lastOrganization.id,
        }
      : null,
    hasMore,
    organizations,
  };
}

export function isOrganizationManagerRole(
  role: OrganizationRole | null
): role is OrganizationRole {
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'editor'
  );
}

export function canManageOrganizationLinks(
  role: OrganizationRole | null
) {
  return (
    role === 'owner' ||
    role === 'admin'
  );
}

export function canManageOrganizationProfile(
  role: OrganizationRole | null
) {
  return (
    role === 'owner' ||
    role === 'admin'
  );
}

export async function updateOrganizationProfile(
  input: UpdateOrganizationProfileInput
) {
  if (
    !canManageOrganizationProfile(
      input.role
    )
  ) {
    throw new Error(
      'Only organization owners and admins can edit the organization profile.'
    );
  }

  const name =
    input.name.trim();

  const description =
    input.description.trim();

  if (
    name.length < 2 ||
    name.length > 100
  ) {
    throw new Error(
      'Organization name must be between 2 and 100 characters.'
    );
  }

  if (
    description.length >
    MAX_ORGANIZATION_DESCRIPTION_CHARACTERS
  ) {
    throw new Error(
      `Organization description can be up to ${MAX_ORGANIZATION_DESCRIPTION_CHARACTERS} characters.`
    );
  }

  if (
    input.asset?.fileSize &&
    input.asset.fileSize >
      MAX_ORGANIZATION_AVATAR_SIZE
  ) {
    throw new Error(
      'Organization avatar must be smaller than 5 MB.'
    );
  }

  let nextAvatarPath =
    input.removeAvatar
      ? null
      : input.currentAvatarPath;

  let uploadedAvatarPath:
    | string
    | null = null;

  if (input.asset) {
    const optimizedAsset =
      await optimizeAvatarAsset(
        input.asset
      );

    const upload =
      await uploadOrganizationAvatarToR2({
        asset:
          optimizedAsset,
        organizationId:
          input.organizationId,
      });

    uploadedAvatarPath =
      upload.objectKey;

    nextAvatarPath =
      upload.objectKey;
  }

  const update: TablesUpdate<'organizations'> =
    {
      avatar_path:
        nextAvatarPath,
      description,
      name,
    };

  const { data, error } =
    await supabase
      .from('organizations')
      .update(update)
      .eq(
        'id',
        input.organizationId
      )
      .select(
        'id, name, description, avatar_path'
      )
      .single();

  if (error) {
    if (uploadedAvatarPath) {
      try {
        await deleteOrganizationAvatar(
          uploadedAvatarPath,
          input.organizationId
        );
      } catch (cleanupError) {
        console.warn(
          '[organization] Could not clean up failed avatar upload.',
          cleanupError
        );
      }
    }

    throw error;
  }

  let avatarCleanupFailed =
    false;

  if (
    input.currentAvatarPath &&
    input.currentAvatarPath !==
      nextAvatarPath
  ) {
    try {
      await deleteOrganizationAvatar(
        input.currentAvatarPath,
        input.organizationId
      );
    } catch (cleanupError) {
      avatarCleanupFailed = true;

      console.warn(
        '[organization] Could not remove previous avatar.',
        cleanupError
      );
    }
  }

  return {
    avatarCleanupFailed,
    organization:
      data,
  };
}

async function deleteOrganizationAvatar(
  path: string,
  organizationId: string
) {
  const cleanPath =
    path.trim();

  if (
    isR2OrganizationAvatarPath(
      cleanPath
    )
  ) {
    const expectedPrefix =
      `${ORGANIZATION_R2_AVATAR_PREFIX}${organizationId}/`;

    if (
      !cleanPath.startsWith(
        expectedPrefix
      )
    ) {
      throw new Error(
        'The avatar path does not belong to this organization.'
      );
    }

    await deleteOrganizationAvatarFromR2({
      objectKey:
        cleanPath,
      organizationId,
    });

    return;
  }

  if (
    !cleanPath.startsWith(
      `${organizationId}/`
    )
  ) {
    throw new Error(
      'The avatar path does not belong to this organization.'
    );
  }

  const { error } =
    await supabase.storage
      .from(
        ORGANIZATION_MEDIA_BUCKET
      )
      .remove([
        cleanPath,
      ]);

  if (error) {
    throw error;
  }
}

export async function getManageableOrganizationsForPosting(
  userId: string
): Promise<ManageableOrganization[]> {
  const { data, error } =
    await supabase
      .from(
        'organization_members'
      )
      .select(`
        role,
        organization:organizations!organization_members_organization_id_fkey (
          id,
          name,
          avatar_path,
          is_verified,
          institute:institutes!organizations_institute_id_fkey (
            short_name
          ),
          university:universities!organizations_university_id_fkey (
            short_name
          )
        )
      `)
      .eq(
        'user_id',
        userId
      )
      .in(
        'role',
        [
          'owner',
          'admin',
          'editor',
        ]
      );

  if (error) {
    throw error;
  }

  const avatarPaths =
    data.flatMap(
      (membership) =>
        membership.organization
          ?.avatar_path
          ? [
              membership
                .organization
                .avatar_path,
            ]
          : []
    );

  const avatarUrls =
    await getSafeOrganizationAvatarUrls(
      avatarPaths
    );

  return data.flatMap(
    (membership) => {
      const organization =
        membership.organization;

      const role =
        toOrganizationRole(
          membership.role
        );

      if (
        !organization ||
        !role
      ) {
        return [];
      }

      return [
        {
          avatarPath:
            organization.avatar_path,
          avatarUrl:
            organization.avatar_path
              ? avatarUrls.get(
                  organization.avatar_path
                ) ?? null
              : null,
          campusShortName:
            organization.institute
              ?.short_name ??
            organization.university
              ?.short_name ??
            'Campus',
          id:
            organization.id,
          isVerified:
            organization.is_verified,
          name:
            organization.name,
          role,
        },
      ];
    }
  );
}

async function getSafeOrganizationAvatarUrls(
  paths: string[]
) {
  try {
    return await getOrganizationAvatarUrls(
      paths
    );
  } catch (error) {
    console.warn(
      '[organization] Could not load organization avatars.',
      error
    );

    return new Map<
      string,
      string
    >();
  }
}

export function canEditOrganizationEvent(
  role: OrganizationRole | null,
  eventCreatorId: string,
  userId: string
) {
  return (
    role === 'owner' ||
    role === 'admin' ||
    (
      role === 'editor' &&
      eventCreatorId === userId
    )
  );
}

export function getOrganizationErrorMessage() {
  return 'We could not load this organization. Check your connection and try again.';
}

export function getOrganizationUpdateErrorMessage(
  error: unknown
) {
  if (isImageUploadError(error)) {
    return error.message;
  }

  if (
    error instanceof Error &&
    (
      error.message.startsWith(
        'Organization name'
      ) ||
      error.message.startsWith(
        'Organization description'
      ) ||
      error.message.startsWith(
        'Organization avatar'
      ) ||
      error.message.startsWith(
        'Only organization owners'
      )
    )
  ) {
    return error.message;
  }

  return 'We could not save the organization profile. Check your connection and try again.';
}

function toOrganizationRole(
  value: string | undefined
): OrganizationRole | null {
  return (
    value === 'owner' ||
    value === 'admin' ||
    value === 'editor'
  )
    ? value
    : null;
}

function getOrganizationCampusShortName(
  row: OrganizationQueryRow
) {
  return (
    row.institute
      ?.short_name ??
    row.university
      ?.short_name ??
    'Campus'
  );
}