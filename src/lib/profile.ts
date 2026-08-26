import type { QueryData } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../types/database';
import type { UserProfile } from '../types/profile';
import {
  deleteUserAvatar,
  getAvatarUrl,
  uploadUserAvatar,
} from './avatars';
import { getProfileBadges } from './badges';
import { isImageUploadError } from './storage';
import { supabase } from './supabase';

export const MAX_BIO_CHARACTERS = 160;
export const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export type InstituteOption = Pick<
  Tables<'institutes'>,
  'id' | 'name' | 'short_name'
>;

export type CreateStudentProfileInput = Omit<
  TablesInsert<'profiles'>,
  | 'avatar_path'
  | 'bio'
  | 'created_at'
  | 'is_verified'
  | 'updated_at'
>;

export type UpdateStudentProfileInput = {
  asset: ImagePickerAsset | null;
  bio: string;
  branch: string;
  currentAvatarPath: string | null;
  fullName: string;
  removeAvatar: boolean;
  userId: string;
  username: string;
  year: number;
};

const USER_PROFILE_SELECT = `
  id,
  full_name,
  username,
  branch,
  year,
  bio,
  avatar_path,
  is_verified,
  institute:institutes!profiles_institute_id_fkey (
    id,
    name,
    short_name
  ),
  posts!posts_author_id_fkey(count)
` as const;

function selectUserProfiles() {
  return supabase.from('profiles').select(USER_PROFILE_SELECT);
}

type UserProfileQueryRow = QueryData<
  ReturnType<typeof selectUserProfiles>
>[number];

export async function getStudentProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isUuid(userId)) {
    return null;
  }

  const [profileResult, organizationFollowingResult] = await Promise.all([
    selectUserProfiles().eq('id', userId).maybeSingle(),
    supabase
      .rpc('get_profile_organization_following_count', {
        target_profile_id: userId,
      }),
  ]);
  const { data, error } = profileResult;

  if (error) {
    throw error;
  }

  if (organizationFollowingResult.error) {
    throw organizationFollowingResult.error;
  }

  if (!data || !data.institute) {
    return null;
  }

  const [avatarUrl, badges] = await Promise.all([
    getProfileAvatarUrl(data.avatar_path),
    getProfileBadges(data.id),
  ]);

  return mapUserProfile(
    data,
    avatarUrl,
    badges,
    organizationFollowingResult.data
  );
}

export async function getInstitutes() {
  const { data, error } = await supabase
    .from('institutes')
    .select('id, name, short_name')
    .order('name');

  if (error) {
    throw error;
  }

  return data;
}

export async function createStudentProfile(
  input: CreateStudentProfileInput
) {
  const { data, error } = await supabase
    .from('profiles')
    .insert(input)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateStudentProfile(input: UpdateStudentProfileInput) {
  const values = validateProfileUpdate(input);
  let nextAvatarPath = input.removeAvatar ? null : input.currentAvatarPath;
  let uploadedAvatarPath: string | null = null;

  if (input.asset) {
    const upload = await uploadUserAvatar(input.asset, input.userId);
    uploadedAvatarPath = upload.path;
    nextAvatarPath = upload.path;
  }

  const update: TablesUpdate<'profiles'> = {
    avatar_path: nextAvatarPath,
    bio: values.bio,
    branch: values.branch,
    full_name: values.fullName,
    username: values.username,
    year: values.year,
  };
  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', input.userId)
    .select('*')
    .single();

  if (error) {
    if (uploadedAvatarPath) {
      try {
        await deleteUserAvatar(uploadedAvatarPath, input.userId);
      } catch (cleanupError) {
        console.warn('[profile] Could not clean up a failed avatar upload.', cleanupError);
      }
    }

    throw error;
  }

  let avatarCleanupFailed = false;

  if (
    input.currentAvatarPath &&
    input.currentAvatarPath !== nextAvatarPath
  ) {
    try {
      await deleteUserAvatar(input.currentAvatarPath, input.userId);
    } catch (cleanupError) {
      avatarCleanupFailed = true;
      console.warn('[profile] Could not remove the previous avatar.', cleanupError);
    }
  }

  return { avatarCleanupFailed, profile: data };
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/^@/, '').toLowerCase();
}

export function getProfileCreationErrorMessage(error: unknown) {
  if (isDuplicateUsernameError(error)) {
    return 'That username is already taken. Try another one.';
  }

  return 'We could not create your profile. Check your connection and try again.';
}

export function getProfileUpdateErrorMessage(error: unknown) {
  if (isImageUploadError(error)) {
    return error.message;
  }

  if (isDuplicateUsernameError(error)) {
    return 'That username is already taken. Try another one.';
  }

  if (
    error instanceof Error &&
    (error.message.startsWith('Enter your full name') ||
      error.message.startsWith('Use 3 to 30') ||
      error.message.startsWith('Enter your branch') ||
      error.message.startsWith('Choose a valid year') ||
      error.message.startsWith('Your bio can'))
  ) {
    return error.message;
  }

  return 'We could not save your profile. Check your connection and try again.';
}

function validateProfileUpdate(input: UpdateStudentProfileInput) {
  const fullName = input.fullName.trim();
  const username = normalizeUsername(input.username);
  const branch = input.branch.trim();
  const bio = input.bio.trim();

  if (fullName.length < 2 || fullName.length > 80) {
    throw new Error('Enter your full name using 2 to 80 characters.');
  }

  if (
    username.length < 3 ||
    username.length > 30 ||
    !USERNAME_PATTERN.test(username)
  ) {
    throw new Error(
      'Use 3 to 30 lowercase letters, numbers, periods, or underscores for your username.'
    );
  }

  if (branch.length < 2 || branch.length > 80) {
    throw new Error('Enter your branch using 2 to 80 characters.');
  }

  if (!Number.isInteger(input.year) || input.year < 1 || input.year > 6) {
    throw new Error('Choose a valid year from 1 to 6.');
  }

  if (bio.length > MAX_BIO_CHARACTERS) {
    throw new Error(`Your bio can be up to ${MAX_BIO_CHARACTERS} characters.`);
  }

  return { bio, branch, fullName, username, year: input.year };
}

function mapUserProfile(
  row: UserProfileQueryRow,
  avatarUrl: string | null,
  badges: UserProfile['badges'],
  organizationFollowingCount: number
): UserProfile {
  if (!row.institute) {
    throw new Error('Profile institute is unavailable.');
  }

  return {
    avatarPath: row.avatar_path,
    avatarUrl,
    badges,
    bio: row.bio,
    branch: row.branch,
    fullName: row.full_name,
    id: row.id,
    institute: {
      id: row.institute.id,
      name: row.institute.name,
      shortName: row.institute.short_name,
    },
    isVerified: row.is_verified,
    organizationFollowingCount,
    postCount: row.posts[0]?.count ?? 0,
    username: row.username,
    year: row.year,
  };
}

async function getProfileAvatarUrl(avatarPath: string | null) {
  if (!avatarPath) {
    return null;
  }

  try {
    return await getAvatarUrl(avatarPath);
  } catch (error) {
    console.warn('[profile] Could not sign avatar URL.', error);
    return null;
  }
}

function isDuplicateUsernameError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';

  return (
    code === '23505' &&
    (message.includes('username') || message.includes('profiles_username_key'))
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
