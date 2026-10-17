import type { Enums } from '../types/database';
import { supabase } from './supabase';

export type AccountModerationStatus = Enums<'account_moderation_status'>;

export type AccountModeration = {
  expiresAt: string | null;
  status: AccountModerationStatus;
  userMessage: string | null;
};

export const ACTIVE_ACCOUNT_MODERATION: AccountModeration = {
  expiresAt: null,
  status: 'active',
  userMessage: null,
};

export async function getCurrentAccountModeration(
  userId: string
): Promise<AccountModeration> {
  const { data, error } = await supabase
    .from('account_moderation')
    .select('status, user_message, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    (data.expires_at !== null && Date.parse(data.expires_at) <= Date.now())
  ) {
    return ACTIVE_ACCOUNT_MODERATION;
  }

  return {
    expiresAt: data.expires_at,
    status: data.status,
    userMessage: data.user_message,
  };
}
