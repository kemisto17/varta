import type { TablesInsert } from '../types/database';
import type { FeedPost } from '../types/post';
import { getPostsByIds } from './posts';
import { supabase } from './supabase';

const SAVED_POSTS_PAGE_SIZE = 20;
const SAVED_IDS_BATCH_SIZE = 1000;

export type SavedPostCursor = {
  postId: string;
  savedAt: string;
};

export type SavedPostsPage = {
  cursor: SavedPostCursor | null;
  hasMore: boolean;
  posts: FeedPost[];
};

export async function getSavedPostIds(userId: string) {
  const savedPostIds = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('post_saves')
      .select('post_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('post_id', { ascending: false })
      .range(from, from + SAVED_IDS_BATCH_SIZE - 1);

    if (error) throw error;
    data.forEach((save) => savedPostIds.add(save.post_id));

    if (data.length < SAVED_IDS_BATCH_SIZE) break;
    from += SAVED_IDS_BATCH_SIZE;
  }

  return savedPostIds;
}

export async function setPostSaved({
  isSaved,
  postId,
  userId,
}: {
  isSaved: boolean;
  postId: string;
  userId: string;
}) {
  if (isSaved) {
    const save: TablesInsert<'post_saves'> = {
      post_id: postId,
      user_id: userId,
    };
    const { error } = await supabase.from('post_saves').insert(save);

    if (error && error.code !== '23505') throw error;
    return;
  }

  const { error } = await supabase
    .from('post_saves')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getSavedPostsPage(
  userId: string,
  cursor: SavedPostCursor | null = null
): Promise<SavedPostsPage> {
  let query = supabase
    .from('post_saves')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('post_id', { ascending: false })
    .limit(SAVED_POSTS_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt."${cursor.savedAt}",and(created_at.eq."${cursor.savedAt}",post_id.lt.${cursor.postId})`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const pageRows = data.slice(0, SAVED_POSTS_PAGE_SIZE);
  const posts = await getPostsByIds(
    pageRows.map((row) => row.post_id),
    userId
  );
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const orderedPosts = pageRows.flatMap((row) => {
    const post = postsById.get(row.post_id);
    return post ? [post] : [];
  });
  const lastRow = pageRows.at(-1) ?? null;

  return {
    cursor: lastRow
      ? { postId: lastRow.post_id, savedAt: lastRow.created_at }
      : null,
    hasMore: data.length > SAVED_POSTS_PAGE_SIZE,
    posts: orderedPosts,
  };
}

export function getSavedPostsErrorMessage() {
  return 'Saved posts could not be loaded. Check your connection and try again.';
}
