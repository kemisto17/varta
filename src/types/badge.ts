import type { Tables } from './database';

type BadgeRow = Tables<'badges'>;
type ProfileBadgeRow = Tables<'profile_badges'>;

export type BadgeVisibility = 'owner_only' | 'public';

export type ProfileBadge = {
  assignedAt: ProfileBadgeRow['assigned_at'];
  description: BadgeRow['description'];
  icon: BadgeRow['icon'];
  id: BadgeRow['id'];
  name: BadgeRow['name'];
  priority: BadgeRow['priority'];
  slug: BadgeRow['slug'];
  visibility: BadgeVisibility;
};
