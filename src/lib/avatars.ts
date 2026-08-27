import type { ImagePickerAsset } from 'expo-image-picker';

import { optimizeAvatarAsset } from './imageOptimization';
import {
  deleteAvatarFromR2,
  uploadAvatarToR2,
} from './r2';
import {
  createPrivateImageUrl,
  createPrivateImageUrls,
} from './storage';
import { supabase } from './supabase';

export const AVATAR_BUCKET = 'avatars';
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_URL_LIFETIME_SECONDS = 60 * 60;

const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_BASE_URL
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '') ?? '';

export async function uploadUserAvatar(
  asset: ImagePickerAsset,
  userId: string
) {
  if (asset.fileSize && asset.fileSize > MAX_AVATAR_SIZE) {
    throw new Error('Avatar must be smaller than 5 MB.');
  }

  const optimizedAsset = await optimizeAvatarAsset(asset);
  const upload = await uploadAvatarToR2(optimizedAsset);
  const expectedPrefix =
    `avatars/users/${userId}/`;

  if (
    !upload.objectKey.startsWith(
      expectedPrefix
    )
  ) {
    throw new Error(
      'The uploaded avatar path is invalid.'
    );
  }

  return {
    path: upload.objectKey,
  };
}

export function getAvatarUrl(path: string) {
  if (isR2AvatarPath(path)) {
    return Promise.resolve(
      getR2AvatarUrl(path)
    );
  }

  return createPrivateImageUrl(
    AVATAR_BUCKET,
    path,
    AVATAR_URL_LIFETIME_SECONDS
  );
}

export async function getAvatarUrls(
  paths: string[]
) {
  const urls = new Map<string, string>();
  const uniquePaths = [...new Set(paths)];
  const legacyPaths = uniquePaths.filter(
    (path) => !isR2AvatarPath(path)
  );

  for (const path of uniquePaths) {
    if (isR2AvatarPath(path)) {
      urls.set(path, getR2AvatarUrl(path));
    }
  }

  if (legacyPaths.length > 0) {
    const legacyUrls =
      await createPrivateImageUrls(
        AVATAR_BUCKET,
        legacyPaths,
        AVATAR_URL_LIFETIME_SECONDS
      );

    for (const [path, url] of legacyUrls) {
      urls.set(path, url);
    }
  }

  return urls;
}

export async function deleteUserAvatar(path: string, userId: string) {
  if (isR2AvatarPath(path)) {
    if (
      !path.startsWith(
        `avatars/users/${userId}/`
      )
    ) {
      throw new Error(
        'The avatar path does not belong to this profile.'
      );
    }

    await deleteAvatarFromR2(path);
    return;
  }

  if (!path.startsWith(`${userId}/`)) {
    throw new Error('The avatar path does not belong to this profile.');
  }

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}

function isR2AvatarPath(path: string) {
  return path.startsWith('avatars/');
}

function getR2AvatarUrl(path: string) {
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
