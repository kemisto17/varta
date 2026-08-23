import type { QueryData } from '@supabase/supabase-js';

import type { TablesInsert } from '../types/database';
import type { PostComment } from '../types/post';
import { supabase } from './supabase';

export const MAX_COMMENT_CHARACTERS = 500;

const COMMENT_SELECT = `
  id,
  post_id,
  author_id,
  content,
  created_at,
  author:profiles!comments_author_id_fkey (
    id,
    full_name,
    branch,
    year
  )
` as const;

function selectComments() {
  return supabase.from('comments').select(COMMENT_SELECT);
}

type CommentQueryRow = QueryData<ReturnType<typeof selectComments>>[number];

export async function getLikedPostIds(postIds: string[], userId: string) {
  if (postIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);

  if (error) {
    throw error;
  }

  return new Set(data.map((like) => like.post_id));
}

export async function setPostLike({
  isLiked,
  postId,
  userId,
}: {
  isLiked: boolean;
  postId: string;
  userId: string;
}) {
  if (isLiked) {
    const like: TablesInsert<'post_likes'> = {
      post_id: postId,
      user_id: userId,
    };
    const { error } = await supabase.from('post_likes').insert(like);

    if (error && error.code !== '23505') {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function getPostComments(postId: string) {
  const { data, error } = await selectComments()
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return data.flatMap((row) => {
    const comment = mapCommentRow(row);

    return comment ? [comment] : [];
  });
}

export async function createPostComment({
  content,
  postId,
  userId,
}: {
  content: string;
  postId: string;
  userId: string;
}) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error('Write a comment before sending.');
  }

  if (normalizedContent.length > MAX_COMMENT_CHARACTERS) {
    throw new Error(
      `Comments can be up to ${MAX_COMMENT_CHARACTERS} characters.`
    );
  }

  const comment: TablesInsert<'comments'> = {
    author_id: userId,
    content: normalizedContent,
    post_id: postId,
  };
  const { data, error } = await supabase
    .from('comments')
    .insert(comment)
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const createdComment = mapCommentRow(data);

  if (!createdComment) {
    throw new Error('Your comment was sent, but it could not be displayed.');
  }

  return createdComment;
}

export async function deletePostComment(commentId: string, userId: string) {
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('This comment could not be deleted.');
  }
}

export function getInteractionErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.startsWith('Write a comment') ||
      error.message.startsWith('Comments can be') ||
      error.message.startsWith('This comment') ||
      error.message.startsWith('Your comment'))
  ) {
    return error.message;
  }

  return 'We could not save that change. Check your connection and try again.';
}

function mapCommentRow(row: CommentQueryRow): PostComment | null {
  if (!row.author) {
    return null;
  }

  return {
    author: {
      branch: row.author.branch,
      fullName: row.author.full_name,
      id: row.author.id,
      year: row.author.year,
    },
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    postId: row.post_id,
  };
}
