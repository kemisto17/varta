import type { ImagePickerAsset } from 'expo-image-picker';

import {
  createPrivateImageUrl,
  createPrivateImageUrls,
  createStorageObjectId,
  uploadImage,
} from './storage';
import { supabase } from './supabase';

export const AVATAR_BUCKET = 'avatars';
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_URL_LIFETIME_SECONDS = 60 * 60;

export function uploadUserAvatar(asset: ImagePickerAsset, userId: string) {
  return uploadImage({
    bucket: AVATAR_BUCKET,
    maxBytes: MAX_AVATAR_SIZE,
    pathBase: `${userId}/${createStorageObjectId()}`,
    source: asset,
  });
}

export function getAvatarUrl(path: string) {
  return createPrivateImageUrl(
    AVATAR_BUCKET,
    path,
    AVATAR_URL_LIFETIME_SECONDS
  );
}

export function getAvatarUrls(paths: string[]) {
  return createPrivateImageUrls(
    AVATAR_BUCKET,
    paths,
    AVATAR_URL_LIFETIME_SECONDS
  );
}

export async function deleteUserAvatar(path: string, userId: string) {
  if (!path.startsWith(`${userId}/`)) {
    throw new Error('The avatar path does not belong to this profile.');
  }

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);

  if (error) {
    throw error;
  }
}
