import type { CampusOrganization, OrganizationRole } from '../types/organization';
import { supabase } from './supabase';

const ORGANIZATION_SELECT = `
  id,
  university_id,
  institute_id,
  name,
  slug,
  description,
  avatar_path,
  is_verified
` as const;

export async function getOrganizationById(
  organizationId: string,
  userId: string
): Promise<CampusOrganization | null> {
  const { data: organization, error } = await supabase
    .from('organizations')
    .select(ORGANIZATION_SELECT)
    .eq('id', organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!organization) {
    return null;
  }

  const [{ data: membership, error: roleError }, { data: follow, error: followError }] =
    await Promise.all([
      supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('organization_follows')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (roleError) {
    throw roleError;
  }

  if (followError) {
    throw followError;
  }

  return {
    avatarPath: organization.avatar_path,
    description: organization.description,
    id: organization.id,
    instituteId: organization.institute_id,
    isFollowed: follow !== null,
    isVerified: organization.is_verified,
    name: organization.name,
    role: toOrganizationRole(membership?.role),
    slug: organization.slug,
    universityId: organization.university_id,
  };
}

export async function setOrganizationFollow({
  isFollowed,
  organizationId,
  userId,
}: {
  isFollowed: boolean;
  organizationId: string;
  userId: string;
}) {
  const query = isFollowed
    ? supabase
        .from('organization_follows')
        .insert({ organization_id: organizationId, user_id: userId })
    : supabase
        .from('organization_follows')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId);
  const { error } = await query;

  if (error) {
    throw error;
  }
}

export async function getFollowedOrganizationIds(userId: string) {
  const { data, error } = await supabase
    .from('organization_follows')
    .select('organization_id')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return data.map((follow) => follow.organization_id);
}

export function isOrganizationManagerRole(
  role: OrganizationRole | null
): role is OrganizationRole {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

export function canEditOrganizationEvent(
  role: OrganizationRole | null,
  eventCreatorId: string,
  userId: string
) {
  return (
    role === 'owner' ||
    role === 'admin' ||
    (role === 'editor' && eventCreatorId === userId)
  );
}

export function getOrganizationErrorMessage() {
  return 'We could not load this organization. Check your connection and try again.';
}

function toOrganizationRole(value: string | undefined): OrganizationRole | null {
  return value === 'owner' || value === 'admin' || value === 'editor'
    ? value
    : null;
}
