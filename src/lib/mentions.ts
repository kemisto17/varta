import { supabase } from './supabase';
import { getAvatarUrls } from './avatars';

export type MentionSuggestion = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
};

export async function searchMentionSuggestions(query: string, userId: string, signal: AbortSignal): Promise<MentionSuggestion[]> {
  if (!/^[a-z0-9._]{0,30}$/i.test(query)) return [];
  const prefix = query.toLowerCase().replace(/_/g, '\\_');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_path')
    .eq('is_verified', true)
    .neq('id', userId)
    .ilike('username', `${prefix}%`)
    .order('username')
    .limit(5)
    .abortSignal(signal);
  if (error) throw error;
  if (signal.aborted) return [];
  const rows = data ?? [];
  const paths = rows.flatMap((row) => row.avatar_path ? [row.avatar_path] : []);
  const avatars = await getAvatarUrls(paths);
  return rows.flatMap((row) => row.username ? [{
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    avatarUrl: row.avatar_path ? avatars.get(row.avatar_path) ?? null : null,
  }] : []);
}

export async function getMentionedProfileId(username: string) {
  const normalizedUsername =
    username.trim().replace(/^@/, '').toLowerCase();

  if (
    !/^[a-z0-9._]{3,30}$/.test(normalizedUsername)
  ) {
    return null;
  }

  const { data, error } =
    await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}
