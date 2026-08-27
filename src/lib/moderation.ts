import type { Enums, TablesInsert } from '../types/database';
import { getAvatarUrls } from './avatars';
import { supabase } from './supabase';

export const MAX_REPORT_DETAILS_CHARACTERS = 1000;

export type ReportReason = Enums<'report_reason'>;
export type ReportTargetType = Enums<'report_target_type'>;

export type ReportTarget = {
  id: string;
  label: string;
  type: ReportTargetType;
};

export type ModerationUser = {
  fullName: string;
  id: string;
};

export type BlockedUser = ModerationUser & {
  avatarUrl: string | null;
  blockedAt: string;
  username: string;
};

export const REPORT_REASONS: readonly {
  description: string;
  label: string;
  value: ReportReason;
}[] = [
  {
    description: 'Repeated or misleading promotion.',
    label: 'Spam',
    value: 'spam',
  },
  {
    description: 'Targeted abuse, bullying or threats.',
    label: 'Harassment',
    value: 'harassment',
  },
  {
    description: 'Attacks based on a protected identity.',
    label: 'Hate speech',
    value: 'hate',
  },
  {
    description: 'Pretending to be another person.',
    label: 'Impersonation',
    value: 'impersonation',
  },
  {
    description: 'Sexual, graphic or otherwise unsafe material.',
    label: 'Inappropriate content',
    value: 'inappropriate_content',
  },
  {
    description: 'Shares personal or sensitive information.',
    label: 'Privacy concern',
    value: 'privacy',
  },
  {
    description: 'Something else the moderators should review.',
    label: 'Other',
    value: 'other',
  },
];

export async function createReport({
  details,
  reason,
  reporterId,
  target,
}: {
  details: string;
  reason: ReportReason;
  reporterId: string;
  target: ReportTarget;
}) {
  const normalizedDetails = details.trim();

  if (normalizedDetails.length > MAX_REPORT_DETAILS_CHARACTERS) {
    throw new Error(
      `Report details can be up to ${MAX_REPORT_DETAILS_CHARACTERS} characters.`
    );
  }

  const report: TablesInsert<'reports'> = {
    comment_id: target.type === 'comment' ? target.id : null,
    details: normalizedDetails || null,
    post_id: target.type === 'post' ? target.id : null,
    profile_id: target.type === 'profile' ? target.id : null,
    reason,
    reporter_id: reporterId,
    target_type: target.type,
  };
  const { error } = await supabase.from('reports').insert(report);

  if (!error) {
    return { duplicate: false };
  }

  if (error.code === '23505') {
    return { duplicate: true };
  }

  throw error;
}

export async function getIsUserBlocked(
  blockerId: string,
  blockedId: string
) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new Error('You cannot block your own profile.');
  }

  const block: TablesInsert<'user_blocks'> = {
    blocked_id: blockedId,
    blocker_id: blockerId,
  };
  const { error } = await supabase.from('user_blocks').insert(block);

  if (error && error.code !== '23505') {
    throw error;
  }
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    throw error;
  }
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_blocked_users'
  );

  if (error) {
    throw error;
  }

  const rows =
    data ?? [];

  const avatarPaths =
    rows.flatMap(
      (row) =>
        row.avatar_path
          ? [row.avatar_path]
          : []
    );

  const avatarUrlByPath =
    await getAvatarUrls(
      avatarPaths
    );

  return rows.map(
    (row) => ({
      avatarUrl:
        row.avatar_path
          ? (
              avatarUrlByPath.get(
                row.avatar_path
              ) ?? null
            )
          : null,

      blockedAt:
        row.blocked_at,

      fullName:
        row.full_name,

      id:
        row.id,

      username:
        row.username,
    })
  );
}

export function getModerationErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.startsWith('Report details can') ||
      error.message.startsWith('You cannot block'))
  ) {
    return error.message;
  }

  return 'We could not save that change. Check your connection and try again.';
}
