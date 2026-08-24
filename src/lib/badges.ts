import type { QueryData } from '@supabase/supabase-js';

import type { ProfileBadge } from '../types/badge';
import { supabase } from './supabase';

const FEED_ROLE_BADGE_MIN_PRIORITY = 60;

const PROFILE_BADGE_SELECT = `
  profile_id,
  assigned_at,
  badge:badges!profile_badges_badge_id_fkey (
    id,
    name,
    slug,
    description,
    icon,
    priority,
    visibility
  )
` as const;

function selectProfileBadges() {
  return supabase.from('profile_badges').select(PROFILE_BADGE_SELECT);
}

type ProfileBadgeQueryRow = QueryData<
  ReturnType<typeof selectProfileBadges>
>[number];

export async function getProfileBadges(
  profileId: string
): Promise<ProfileBadge[]> {
  const { data, error } = await selectProfileBadges().eq(
    'profile_id',
    profileId
  );

  if (error) {
    throw error;
  }

  return mapAndSortBadges(data).map(({ badge }) => badge);
}

export async function getPublicPrimaryBadges(
  profileIds: string[]
): Promise<Map<string, ProfileBadge>> {
  const uniqueProfileIds = [...new Set(profileIds)];

  if (uniqueProfileIds.length === 0) {
    return new Map();
  }

  const { data, error } = await selectProfileBadges().in(
    'profile_id',
    uniqueProfileIds
  );

  if (error) {
    throw error;
  }

  const primaryBadges = new Map<string, ProfileBadge>();

  for (const assignment of mapAndSortBadges(data)) {
    if (
      assignment.badge.visibility === 'public' &&
      assignment.badge.priority >= FEED_ROLE_BADGE_MIN_PRIORITY &&
      !primaryBadges.has(assignment.profileId)
    ) {
      primaryBadges.set(assignment.profileId, assignment.badge);
    }
  }

  return primaryBadges;
}

function mapAndSortBadges(rows: ProfileBadgeQueryRow[]) {
  return rows
    .flatMap((row) => {
      if (!row.badge || !isBadgeVisibility(row.badge.visibility)) {
        return [];
      }

      return [
        {
          badge: {
            assignedAt: row.assigned_at,
            description: row.badge.description,
            icon: row.badge.icon,
            id: row.badge.id,
            name: row.badge.name,
            priority: row.badge.priority,
            slug: row.badge.slug,
            visibility: row.badge.visibility,
          } satisfies ProfileBadge,
          profileId: row.profile_id,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.badge.priority - left.badge.priority ||
        left.badge.name.localeCompare(right.badge.name)
    );
}

function isBadgeVisibility(value: string): value is ProfileBadge['visibility'] {
  return value === 'public' || value === 'owner_only';
}
