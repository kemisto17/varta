import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const WRITE_BLOCKING_STATUSES = new Set([
  "restricted",
  "suspended",
  "banned",
]);

export async function accountCanWrite(
  supabase: SupabaseClient,
  userId: string
) {
  const status = await getEffectiveAccountModerationStatus(supabase, userId);
  return !WRITE_BLOCKING_STATUSES.has(status);
}

export async function getEffectiveAccountModerationStatus(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("account_moderation")
    .select("status, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    (data.expires_at !== null &&
      Date.parse(data.expires_at) <= Date.now())
  ) {
    return "active";
  }

  return data.status as string;
}
