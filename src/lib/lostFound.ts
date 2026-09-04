import type { QueryData } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { TablesInsert, TablesUpdate } from '../types/database';
import {
  LOST_FOUND_CATEGORIES,
  type LostFoundCategory,
  type LostFoundCursor,
  type LostFoundDraft,
  type LostFoundFilter,
  type LostFoundItem,
  type LostFoundKind,
  type LostFoundStatus,
} from '../types/lostFound';
import { getAvatarUrls } from './avatars';
import { optimizePostImageAsset } from './imageOptimization';
import { getOrganizationAvatarUrls } from './organizations';
import {
  deleteLostFoundImageFromR2,
  uploadLostFoundImageToR2,
} from './r2';
import { createPrivateImageUrls, isImageUploadError } from './storage';
import { supabase } from './supabase';

export const LOST_FOUND_PAGE_SIZE = 20;
export const MAX_LOST_FOUND_TITLE_CHARACTERS = 100;
export const MAX_LOST_FOUND_DESCRIPTION_CHARACTERS = 500;
export const MAX_LOST_FOUND_LOCATION_CHARACTERS = 160;

const POST_MEDIA_BUCKET = 'post-media';

const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_BASE_URL
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '') ?? '';

const LOST_FOUND_SELECT = `
  id,
  created_by,
  organization_author_id,
  kind,
  title,
  description,
  category,
  campus_location,
  item_date,
  image_path,
  status,
  resolved_at,
  created_at,
  updated_at,
  creator:profiles!lost_found_items_created_by_fkey (
    id,
    full_name,
    username,
    avatar_path,
    is_verified,
    institute:institutes!profiles_institute_id_fkey (
      id,
      short_name
    )
  ),
  organization_author:organizations!lost_found_items_organization_author_id_fkey (
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
` as const;

function selectLostFoundItems() {
  return supabase.from('lost_found_items').select(LOST_FOUND_SELECT);
}

type LostFoundQueryRow =
  QueryData<ReturnType<typeof selectLostFoundItems>>[number];

export type LostFoundPage = {
  cursor: LostFoundCursor | null;
  hasMore: boolean;
  items: LostFoundItem[];
};

export async function getLostFoundPage(
  viewerUserId: string,
  filter: LostFoundFilter,
  cursor: LostFoundCursor | null = null
): Promise<LostFoundPage> {
  let query = selectLostFoundItems()
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LOST_FOUND_PAGE_SIZE + 1);

  if (filter === 'resolved') {
    query = query.eq('status', 'resolved');
  } else {
    query = query.eq('status', 'active');

    if (filter === 'lost' || filter === 'found') {
      query = query.eq('kind', filter);
    }
  }

  if (cursor) {
    query = query.or(
      `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const pageRows = data.slice(0, LOST_FOUND_PAGE_SIZE);
  const items = await hydrateLostFoundRows(pageRows, viewerUserId);
  const lastItem = items.at(-1) ?? null;

  return {
    cursor: lastItem
      ? { createdAt: lastItem.createdAt, id: lastItem.id }
      : null,
    hasMore: data.length > LOST_FOUND_PAGE_SIZE,
    items,
  };
}

export async function getLostFoundItemById(
  itemId: string,
  viewerUserId: string
) {
  const { data, error } = await selectLostFoundItems()
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const items = await hydrateLostFoundRows([data], viewerUserId);
  return items[0] ?? null;
}

export async function createLostFoundItem({
  asset,
  draft,
  userId,
}: {
  asset: ImagePickerAsset | null;
  draft: LostFoundDraft;
  userId: string;
}) {
  const normalized = validateLostFoundDraft(draft, asset);
  let imagePath: string | null = null;

  if (asset) {
    const optimizedAsset = await optimizePostImageAsset(asset);
    const upload = await uploadLostFoundImageToR2(optimizedAsset);
    imagePath = upload.objectKey.trim();
  }

  const item: TablesInsert<'lost_found_items'> = {
    campus_location: normalized.campusLocation,
    category: normalized.category,
    created_by: userId,
    description: normalized.description,
    image_path: imagePath,
    item_date: normalized.itemDate,
    kind: normalized.kind,
    organization_author_id: null,
    title: normalized.title,
  };

  const { data, error } = await supabase
    .from('lost_found_items')
    .insert(item)
    .select('id')
    .single();

  if (error) {
    if (imagePath) {
      await cleanUpLostFoundImage(imagePath, 'listing insert failure');
    }

    throw error;
  }

  return data;
}

export async function updateLostFoundItem({
  asset,
  draft,
  item,
  removeImage,
}: {
  asset: ImagePickerAsset | null;
  draft: LostFoundDraft;
  item: Pick<
    LostFoundItem,
    'canEditByCurrentUser' | 'id' | 'imagePath'
  >;
  removeImage: boolean;
}) {
  if (!item.canEditByCurrentUser) {
    throw new Error('You are not allowed to edit this listing.');
  }

  const normalized = validateLostFoundDraft(draft, asset);
  let uploadedImagePath: string | null = null;
  let nextImagePath = removeImage ? null : item.imagePath;

  if (asset) {
    const optimizedAsset = await optimizePostImageAsset(asset);
    const upload = await uploadLostFoundImageToR2(optimizedAsset);
    uploadedImagePath = upload.objectKey.trim();
    nextImagePath = uploadedImagePath;
  }

  const changes: TablesUpdate<'lost_found_items'> = {
    campus_location: normalized.campusLocation,
    category: normalized.category,
    description: normalized.description,
    image_path: nextImagePath,
    item_date: normalized.itemDate,
    kind: normalized.kind,
    title: normalized.title,
  };

  const { data, error } = await supabase
    .from('lost_found_items')
    .update(changes)
    .eq('id', item.id)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    if (uploadedImagePath) {
      await cleanUpLostFoundImage(uploadedImagePath, 'listing update failure');
    }

    if (error) {
      throw error;
    }

    throw new Error('This listing could not be found.');
  }

  if (item.imagePath && item.imagePath !== nextImagePath) {
    await cleanUpLostFoundImage(item.imagePath, 'listing update');
  }

  return data;
}

export async function setLostFoundResolved(
  item: Pick<LostFoundItem, 'canEditByCurrentUser' | 'id' | 'resolvedAt'>,
  resolved: boolean
) {
  if (!item.canEditByCurrentUser) {
    throw new Error('You are not allowed to update this listing.');
  }

  const status: LostFoundStatus = resolved ? 'resolved' : 'active';
  const { data, error } = await supabase
    .from('lost_found_items')
    .update({
      resolved_at: resolved
        ? item.resolvedAt ?? new Date().toISOString()
        : null,
      status,
    })
    .eq('id', item.id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('This listing could not be found.');
  }

  return data;
}

export async function deleteLostFoundItem(
  item: Pick<LostFoundItem, 'canDeleteByCurrentUser' | 'id' | 'imagePath'>
) {
  if (!item.canDeleteByCurrentUser) {
    throw new Error('You are not allowed to delete this listing.');
  }

  const { data, error } = await supabase
    .from('lost_found_items')
    .delete()
    .eq('id', item.id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('This listing could not be found.');
  }

  if (!item.imagePath || !item.imagePath.startsWith('lost-found/')) {
    return { mediaCleanupFailed: false };
  }

  try {
    await deleteLostFoundImageFromR2(item.imagePath);
    return { mediaCleanupFailed: false };
  } catch (error) {
    console.warn('[lost-found] Could not delete listing media.', error);
    return { mediaCleanupFailed: true };
  }
}

export function getLostFoundErrorMessage(error: unknown) {
  if (isImageUploadError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    const knownStarts = [
      'Choose an image',
      'Description can be',
      'Enter a title',
      'Location can be',
      'Select a valid',
      'This listing could',
      'Title can be',
      'You are not allowed',
    ];

    if (
      knownStarts.some((prefix) => error.message.startsWith(prefix)) ||
      error.message.includes('could not be read') ||
      error.message.includes('image upload') ||
      error.message.includes('Image upload') ||
      error.message.includes('prepare image')
    ) {
      return error.message;
    }
  }

  return 'Something went wrong. Check your connection and try again.';
}

export function getLostFoundCategoryLabel(category: LostFoundCategory) {
  return (
    LOST_FOUND_CATEGORIES.find((option) => option.value === category)?.label ??
    'Other'
  );
}

function validateLostFoundDraft(
  draft: LostFoundDraft,
  asset: ImagePickerAsset | null
): Omit<LostFoundDraft, 'campusLocation'> & {
  campusLocation: string | null;
} {
  const title = draft.title.trim();
  const description = draft.description.trim();
  const campusLocation = draft.campusLocation.trim();

  if (!title) {
    throw new Error('Enter a title for the item.');
  }

  if (title.length > MAX_LOST_FOUND_TITLE_CHARACTERS) {
    throw new Error(
      `Title can be up to ${MAX_LOST_FOUND_TITLE_CHARACTERS} characters.`
    );
  }

  if (!description) {
    throw new Error('Enter a description for the item.');
  }

  if (description.length > MAX_LOST_FOUND_DESCRIPTION_CHARACTERS) {
    throw new Error(
      `Description can be up to ${MAX_LOST_FOUND_DESCRIPTION_CHARACTERS} characters.`
    );
  }

  if (campusLocation.length > MAX_LOST_FOUND_LOCATION_CHARACTERS) {
    throw new Error(
      `Location can be up to ${MAX_LOST_FOUND_LOCATION_CHARACTERS} characters.`
    );
  }

  if (!isLostFoundKind(draft.kind) || !isLostFoundCategory(draft.category)) {
    throw new Error('Select a valid Lost & Found type and category.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.itemDate)) {
    throw new Error('Select a valid item date.');
  }

  if (asset?.fileSize && asset.fileSize > 8 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 8 MB.');
  }

  return {
    campusLocation: campusLocation || null,
    category: draft.category,
    description,
    itemDate: draft.itemDate,
    kind: draft.kind,
    title,
  };
}

function isLostFoundKind(value: string): value is LostFoundKind {
  return value === 'lost' || value === 'found';
}

function isLostFoundCategory(value: string): value is LostFoundCategory {
  return LOST_FOUND_CATEGORIES.some((option) => option.value === value);
}

function normalizeLostFoundCategory(value: string): LostFoundCategory {
  return isLostFoundCategory(value) ? value : 'other';
}

function normalizeLostFoundKind(value: string): LostFoundKind {
  return value === 'found' ? 'found' : 'lost';
}

function normalizeLostFoundStatus(value: string): LostFoundStatus {
  return value === 'resolved' ? 'resolved' : 'active';
}

async function hydrateLostFoundRows(
  rows: LostFoundQueryRow[],
  viewerUserId: string
) {
  const imagePaths = uniqueStrings(rows.map((row) => row.image_path));
  const avatarPaths = uniqueStrings(rows.map((row) => row.creator?.avatar_path));
  const organizationAvatarPaths = uniqueStrings(
    rows.map((row) => row.organization_author?.avatar_path)
  );
  const organizationIds = uniqueStrings(
    rows.map((row) => row.organization_author?.id)
  );

  const [imageUrls, avatarUrls, organizationAvatarUrls, manageableIds] =
    await Promise.all([
      getLostFoundMediaUrls(imagePaths),
      getSafeAvatarUrls(avatarPaths),
      getSafeOrganizationAvatarUrls(organizationAvatarPaths),
      getManageableOrganizationIds(organizationIds, viewerUserId),
    ]);

  return rows.flatMap((row) => {
    const author = row.creator?.institute
      ? {
          avatarPath: row.creator.avatar_path,
          avatarUrl: row.creator.avatar_path
            ? avatarUrls.get(row.creator.avatar_path) ?? null
            : null,
          fullName: row.creator.full_name,
          id: row.creator.id,
          institute: {
            id: row.creator.institute.id,
            short_name: row.creator.institute.short_name,
          },
          isVerified: row.creator.is_verified,
          kind: 'student' as const,
          username: row.creator.username,
        }
      : row.organization_author
        ? {
            avatarPath: row.organization_author.avatar_path,
            avatarUrl: row.organization_author.avatar_path
              ? organizationAvatarUrls.get(row.organization_author.avatar_path) ??
                null
              : null,
            campusShortName:
              row.organization_author.institute?.short_name ??
              row.organization_author.university?.short_name ??
              'Campus',
            fullName: row.organization_author.name,
            id: row.organization_author.id,
            isVerified: row.organization_author.is_verified,
            kind: 'organization' as const,
          }
        : null;

    if (!author) {
      return [];
    }

    const canManage =
      row.created_by === viewerUserId ||
      (row.organization_author_id !== null &&
        manageableIds.has(row.organization_author_id));

    return [
      {
        author,
        campusLocation: row.campus_location,
        canDeleteByCurrentUser: canManage,
        canEditByCurrentUser: canManage,
        category: normalizeLostFoundCategory(row.category),
        createdAt: row.created_at,
        createdBy: row.created_by,
        description: row.description,
        id: row.id,
        imagePath: row.image_path,
        imageUrl: row.image_path ? imageUrls.get(row.image_path) ?? null : null,
        itemDate: row.item_date,
        kind: normalizeLostFoundKind(row.kind),
        organizationAuthorId: row.organization_author_id,
        resolvedAt: row.resolved_at,
        status: normalizeLostFoundStatus(row.status),
        title: row.title,
        updatedAt: row.updated_at,
      },
    ];
  }) satisfies LostFoundItem[];
}

function uniqueStrings(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function getLostFoundMediaUrls(paths: string[]) {
  const urls = new Map<string, string>();
  const legacyPaths: string[] = [];

  for (const path of paths) {
    if (path.startsWith('lost-found/') || path.startsWith('posts/')) {
      if (MEDIA_BASE_URL) {
        urls.set(path, `${MEDIA_BASE_URL}/${path.replace(/^\/+/, '')}`);
      }
    } else {
      legacyPaths.push(path);
    }
  }

  if (legacyPaths.length > 0) {
    try {
      const signed = await createPrivateImageUrls(POST_MEDIA_BUCKET, legacyPaths);
      for (const [path, url] of signed) {
        urls.set(path, url);
      }
    } catch (error) {
      console.warn('[lost-found] Could not sign legacy listing media.', error);
    }
  }

  return urls;
}

async function getSafeAvatarUrls(paths: string[]) {
  try {
    return await getAvatarUrls(paths);
  } catch (error) {
    console.warn('[lost-found] Could not load creator avatars.', error);
    return new Map<string, string>();
  }
}

async function getSafeOrganizationAvatarUrls(paths: string[]) {
  try {
    return await getOrganizationAvatarUrls(paths);
  } catch (error) {
    console.warn('[lost-found] Could not load organization avatars.', error);
    return new Map<string, string>();
  }
}

async function getManageableOrganizationIds(
  organizationIds: string[],
  viewerUserId: string
) {
  if (organizationIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', viewerUserId)
    .in('organization_id', organizationIds)
    .in('role', ['owner', 'admin', 'editor']);

  if (error) {
    throw error;
  }

  return new Set(data.map((membership) => membership.organization_id));
}

async function cleanUpLostFoundImage(imagePath: string, reason: string) {
  if (!imagePath.startsWith('lost-found/')) {
    return;
  }

  try {
    await deleteLostFoundImageFromR2(imagePath);
  } catch (error) {
    console.warn(`[lost-found] Could not clean up media after ${reason}.`, error);
  }
}
