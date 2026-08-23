import type { ImagePickerAsset } from 'expo-image-picker';

import type { TablesInsert } from '../types/database';
import type { FeedCursor, FeedPost } from '../types/post';
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
    institute:institutes!profiles_institute_id_fkey (
      id,
      name,
      short_name
    )
  ),
  post_likes(count),
  comments(count)
` as const;

type PublishPostInput = {
  asset: ImagePickerAsset | null;
  content: string;
  userId: string;
};

export type FeedPage = {
  cursor: FeedCursor | null;
  hasMore: boolean;
  posts: FeedPost[];
};

export async function getFeedPage(
  cursor: FeedCursor | null = null
): Promise<FeedPage> {
  let query = supabase
    .from('posts')
    .select(FEED_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(POSTS_PAGE_SIZE + 1);

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
  const signedUrls = await getSignedPostMediaUrls(imagePaths);
  const posts: FeedPost[] = pageRows.flatMap((row) => {
    if (!row.author || !row.author.institute) {
      return [];
    }

    return [
      {
        author: {
          avatarPath: row.author.avatar_path,
          branch: row.author.branch,
          fullName: row.author.full_name,
          id: row.author.id,
          institute: {
            id: row.author.institute.id,
            name: row.author.institute.name,
            shortName: row.author.institute.short_name,
          },
          username: row.author.username,
          year: row.author.year,
        },
        authorId: row.author_id,
        commentCount: row.comments[0]?.count ?? 0,
        content: row.content,
        createdAt: row.created_at,
        id: row.id,
        imagePath: row.image_path,
        imageUrl: row.image_path ? (signedUrls.get(row.image_path) ?? null) : null,
        likeCount: row.post_likes[0]?.count ?? 0,
      },
    ];
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

export async function publishPost({
  asset,
  content,
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
      pathBase: `${userId}/${createStorageObjectId()}`,
      source: asset,
    });

    imagePath = upload.path;
  }

  const post: TablesInsert<'posts'> = {
    author_id: userId,
    content: normalizedContent,
    image_path: imagePath,
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
  post: Pick<FeedPost, 'authorId' | 'id' | 'imagePath'>,
  userId: string
) {
  if (post.authorId !== userId) {
    throw new Error('You can only delete your own posts.');
  }

  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', post.id)
    .eq('author_id', userId)
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
      error.message.startsWith('You can only') ||
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

export function getPostImageUrl(imagePath: string) {
  return createPrivateImageUrl(POST_MEDIA_BUCKET, imagePath, 60 * 60);
}
