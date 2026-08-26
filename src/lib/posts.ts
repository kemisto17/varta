import type { QueryData } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { ProfileBadge } from '../types/badge';
import type { TablesInsert } from '../types/database';
import type { FeedCursor, FeedPost } from '../types/post';
import { getAvatarUrls } from './avatars';
import { getPublicPrimaryBadges } from './badges';
import { getOrganizationAvatarUrls } from './organizations';
import { getLikedPostIds } from './postInteractions';
import {
  createPrivateImageUrl,
  createPrivateImageUrls,
  createStorageObjectId,
  isImageUploadError,
  uploadImage,
} from './storage';
import { supabase } from './supabase';

export const MAX_POST_CHARACTERS = 500;
export const MAX_POST_IMAGE_SIZE = 8 * 1024 * 1024;
export const POST_MEDIA_BUCKET = 'post-media';
export const POSTS_PAGE_SIZE = 20;

const FEED_SELECT = `
  id,
  author_id,
  organization_author_id,
  content,
  image_path,
  created_at,
  author:profiles!posts_author_id_fkey (
    id,
    full_name,
    username,
    branch,
    year,
    avatar_path,
    is_verified,
    institute:institutes!profiles_institute_id_fkey (
      id,
      name,
      short_name
    )
  ),
  organization_author:organizations!posts_organization_author_id_fkey (
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
  ),
  post_likes(count),
  comments(count)
` as const;

function selectPosts() {
  return supabase.from('posts').select(FEED_SELECT);
}

type PostQueryRow = QueryData<ReturnType<typeof selectPosts>>[number];

type PublishPostInput = {
  asset: ImagePickerAsset | null;
  content: string;
  organizationId?: string | null;
  userId: string;
};

export type FeedPage = {
  cursor: FeedCursor | null;
  hasMore: boolean;
  posts: FeedPost[];
};

export async function getFeedPage(
  userId: string,
  cursor: FeedCursor | null = null
): Promise<FeedPage> {
  return getPostsPage(userId, cursor);
}

export async function getUserPostsPage(
  profileUserId: string,
  viewerUserId: string,
  cursor: FeedCursor | null = null
): Promise<FeedPage> {
  return getPostsPage(viewerUserId, cursor, profileUserId);
}

export async function getOrganizationPostsPage(
  organizationId: string,
  viewerUserId: string,
  cursor: FeedCursor | null = null
): Promise<FeedPage> {
  return getPostsPage(viewerUserId, cursor, null, organizationId);
}

async function getPostsPage(
  viewerUserId: string,
  cursor: FeedCursor | null,
  authorId: string | null = null,
  organizationAuthorId: string | null = null
): Promise<FeedPage> {
  let query = selectPosts()
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(POSTS_PAGE_SIZE + 1);

  if (authorId) {
    query = query.eq('author_id', authorId);
  }

  if (organizationAuthorId) {
    query = query.eq('organization_author_id', organizationAuthorId);
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

  const pageRows = data.slice(0, POSTS_PAGE_SIZE);
  const imagePaths = [
    ...new Set(
      pageRows
        .map((row) => row.image_path)
        .filter((path): path is string => path !== null)
    ),
  ];
  const avatarPaths = [
    ...new Set(
      pageRows
        .map((row) => row.author?.avatar_path ?? null)
        .filter((path): path is string => path !== null)
    ),
  ];
  const organizationAvatarPaths = [
    ...new Set(
      pageRows
        .map((row) => row.organization_author?.avatar_path ?? null)
        .filter((path): path is string => path !== null)
    ),
  ];
  const organizationIds = pageRows.flatMap((row) =>
    row.organization_author ? [row.organization_author.id] : []
  );
  const [
    signedUrls,
    avatarUrls,
    organizationAvatarUrls,
    likedPostIds,
    primaryBadges,
    manageableOrganizationIds,
  ] =
    await Promise.all([
      getSignedPostMediaUrls(imagePaths),
      getSignedAvatarUrls(avatarPaths),
      getSignedOrganizationAvatarUrls(organizationAvatarPaths),
      getLikedPostIds(
        pageRows.map((row) => row.id),
        viewerUserId
      ),
      getPublicPrimaryBadges(
        pageRows.flatMap((row) => (row.author ? [row.author.id] : []))
      ),
      getManageableOrganizationIds(organizationIds, viewerUserId),
    ]);
  const posts = pageRows.flatMap((row) => {
    const post = mapPostRow(
      row,
      signedUrls,
      avatarUrls,
      organizationAvatarUrls,
      likedPostIds,
      primaryBadges,
      manageableOrganizationIds,
      viewerUserId
    );

    return post ? [post] : [];
  });
  const lastPost = posts.at(-1) ?? null;

  return {
    cursor: lastPost
      ? { createdAt: lastPost.createdAt, id: lastPost.id }
      : null,
    hasMore: data.length > POSTS_PAGE_SIZE,
    posts,
  };
}

export async function getPostById(postId: string, userId: string) {
  const { data, error } = await selectPosts().eq('id', postId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const imagePaths = data.image_path ? [data.image_path] : [];
  const avatarPaths = data.author?.avatar_path ? [data.author.avatar_path] : [];
  const organizationAvatarPaths = data.organization_author?.avatar_path
    ? [data.organization_author.avatar_path]
    : [];
  const organizationIds = data.organization_author
    ? [data.organization_author.id]
    : [];
  const [
    signedUrls,
    avatarUrls,
    organizationAvatarUrls,
    likedPostIds,
    primaryBadges,
    manageableOrganizationIds,
  ] =
    await Promise.all([
      getSignedPostMediaUrls(imagePaths),
      getSignedAvatarUrls(avatarPaths),
      getSignedOrganizationAvatarUrls(organizationAvatarPaths),
      getLikedPostIds([data.id], userId),
      getPublicPrimaryBadges(data.author ? [data.author.id] : []),
      getManageableOrganizationIds(organizationIds, userId),
    ]);

  return mapPostRow(
    data,
    signedUrls,
    avatarUrls,
    organizationAvatarUrls,
    likedPostIds,
    primaryBadges,
    manageableOrganizationIds,
    userId
  );
}

export async function publishPost({
  asset,
  content,
  organizationId = null,
  userId,
}: PublishPostInput) {
  const normalizedContent = content.trim();

  if (!normalizedContent && !asset) {
    throw new Error('Write something or add a photo before publishing.');
  }

  if (normalizedContent.length > MAX_POST_CHARACTERS) {
    throw new Error(`Posts can be up to ${MAX_POST_CHARACTERS} characters.`);
  }

  let imagePath: string | null = null;

  if (asset) {
    const upload = await uploadImage({
      bucket: POST_MEDIA_BUCKET,
      maxBytes: MAX_POST_IMAGE_SIZE,
      pathBase: organizationId
        ? `${organizationId}/${userId}/${createStorageObjectId()}`
        : `${userId}/${createStorageObjectId()}`,
      source: asset,
    });

    imagePath = upload.path;
  }

  const post: TablesInsert<'posts'> = {
    author_id: organizationId ? null : userId,
    content: normalizedContent,
    image_path: imagePath,
    organization_author_id: organizationId,
  };
  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select('id')
    .single();

  if (error) {
    if (imagePath) {
      await supabase.storage.from(POST_MEDIA_BUCKET).remove([imagePath]);
    }

    throw error;
  }

  return data;
}

export async function deletePost(
  post: Pick<FeedPost, 'canDeleteByCurrentUser' | 'id' | 'imagePath'>,
  _userId: string
) {
  if (!post.canDeleteByCurrentUser) {
    throw new Error('You are not allowed to delete this post.');
  }

  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', post.id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('This post could not be found or is no longer available.');
  }

  if (!post.imagePath) {
    return { mediaCleanupFailed: false };
  }

  const { error: cleanupError } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .remove([post.imagePath]);

  return { mediaCleanupFailed: cleanupError !== null };
}

export function getPostErrorMessage(error: unknown) {
  if (isImageUploadError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    if (
      error.message.startsWith('Choose an image') ||
      error.message.startsWith('Posts can be') ||
      error.message.startsWith('Write something') ||
      error.message.startsWith('You are not allowed') ||
      error.message.startsWith('This post could') ||
      error.message.includes('could not be read')
    ) {
      return error.message;
    }
  }

  return 'Something went wrong. Check your connection and try again.';
}

async function getSignedPostMediaUrls(paths: string[]) {
  try {
    return await createPrivateImageUrls(POST_MEDIA_BUCKET, paths);
  } catch (error) {
    console.warn('[feed] Could not sign post media URLs.', error);
    return new Map<string, string>();
  }
}

async function getSignedAvatarUrls(paths: string[]) {
  try {
    return await getAvatarUrls(paths);
  } catch (error) {
    console.warn('[feed] Could not sign avatar URLs.', error);
    return new Map<string, string>();
  }
}

async function getSignedOrganizationAvatarUrls(paths: string[]) {
  try {
    return await getOrganizationAvatarUrls(paths);
  } catch (error) {
    console.warn('[feed] Could not sign organization avatar URLs.', error);
    return new Map<string, string>();
  }
}

async function getManageableOrganizationIds(
  organizationIds: string[],
  userId: string
) {
  if (organizationIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .in('organization_id', [...new Set(organizationIds)])
    .in('role', ['owner', 'admin', 'editor']);

  if (error) {
    throw error;
  }

  return new Set(data.map((membership) => membership.organization_id));
}

export function getPostImageUrl(imagePath: string) {
  return createPrivateImageUrl(POST_MEDIA_BUCKET, imagePath, 60 * 60);
}

function mapPostRow(
  row: PostQueryRow,
  signedUrls: Map<string, string>,
  avatarUrls: Map<string, string>,
  organizationAvatarUrls: Map<string, string>,
  likedPostIds: Set<string>,
  primaryBadges: Map<string, ProfileBadge>,
  manageableOrganizationIds: Set<string>,
  viewerUserId: string
): FeedPost | null {
  if (!row.author && !row.organization_author) {
    return null;
  }

  const author = row.author?.institute
    ? {
        avatarPath: row.author.avatar_path,
        avatarUrl: row.author.avatar_path
          ? (avatarUrls.get(row.author.avatar_path) ?? null)
          : null,
        branch: row.author.branch,
        fullName: row.author.full_name,
        id: row.author.id,
        institute: {
          id: row.author.institute.id,
          name: row.author.institute.name,
          shortName: row.author.institute.short_name,
        },
        isVerified: row.author.is_verified,
        kind: 'student' as const,
        primaryBadge: primaryBadges.get(row.author.id) ?? null,
        username: row.author.username,
        year: row.author.year,
      }
    : row.organization_author
      ? {
          avatarPath: row.organization_author.avatar_path,
          avatarUrl: row.organization_author.avatar_path
            ? (organizationAvatarUrls.get(row.organization_author.avatar_path) ??
              null)
            : null,
          campusShortName:
            row.organization_author.institute?.short_name ??
            row.organization_author.university?.short_name ??
            'Campus',
          fullName: row.organization_author.name,
          id: row.organization_author.id,
          isVerified: row.organization_author.is_verified,
          kind: 'organization' as const,
          primaryBadge: null,
        }
      : null;

  if (!author) {
    return null;
  }

  return {
    author,
    authorId: row.author_id,
    canDeleteByCurrentUser:
      row.author_id === viewerUserId ||
      (row.organization_author_id !== null &&
        manageableOrganizationIds.has(row.organization_author_id)),
    commentCount: row.comments[0]?.count ?? 0,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    imagePath: row.image_path,
    imageUrl: row.image_path ? (signedUrls.get(row.image_path) ?? null) : null,
    isLikedByCurrentUser: likedPostIds.has(row.id),
    likeCount: row.post_likes[0]?.count ?? 0,
    organizationAuthorId: row.organization_author_id,
  };
}
