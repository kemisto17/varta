import type { ProfileBadge } from '../types/badge';
import type {
  HomeFeedCursor,
  HomeFeedItem,
  HomeFeedMode,
  HomeFeedPage,
} from '../types/feed';
import type { EventStatus } from '../types/event';
import type { LostFoundCategory, LostFoundKind, LostFoundStatus } from '../types/lostFound';
import type { PostKind } from '../types/post';
import { getAvatarUrls } from './avatars';
import { getPublicPrimaryBadges } from './badges';
import { getOrganizationAvatarUrls } from './organizations';
import { POSTS_PAGE_SIZE } from './posts';
import { createPrivateImageUrls } from './storage';
import { supabase } from './supabase';

type HomeFeedRpcRow = {
  event_cover_path: string | null;
  event_created_by: string | null;
  event_description: string | null;
  event_ends_at: string | null;
  event_id: string | null;
  event_institute_id: string | null;
  event_interested_count: number | null;
  event_is_interested_by_viewer: boolean | null;
  event_location: string | null;
  event_organization_id: string | null;
  event_registration_url: string | null;
  event_starts_at: string | null;
  event_status: string | null;
  event_title: string | null;
  event_university_id: string | null;
  item_id: string;
  item_type: string;
  lost_found_campus_location: string | null;
  lost_found_category: string | null;
  lost_found_created_at: string | null;
  lost_found_created_by: string | null;
  lost_found_description: string | null;
  lost_found_id: string | null;
  lost_found_image_path: string | null;
  lost_found_item_date: string | null;
  lost_found_kind: string | null;
  lost_found_organization_author_id: string | null;
  lost_found_resolved_at: string | null;
  lost_found_status: string | null;
  lost_found_title: string | null;
  lost_found_updated_at: string | null;
  organization_author_avatar_path: string | null;
  organization_author_id: string | null;
  organization_author_institute_short_name: string | null;
  organization_author_is_verified: boolean | null;
  organization_author_name: string | null;
  organization_author_university_short_name: string | null;
  organization_can_manage_by_viewer: boolean;
  organization_is_followed_by_viewer: boolean;
  post_author_id: string | null;
  post_comment_count: number;
  post_content: string | null;
  post_created_at: string | null;
  post_id: string | null;
  post_image_path: string | null;
  post_is_liked_by_viewer: boolean;
  post_kind: string | null;
  post_like_count: number;
  post_organization_author_id: string | null;
  post_updated_at: string | null;
  ranking_score: number;
  sort_created_at: string;
  student_author_avatar_path: string | null;
  student_author_branch: string | null;
  student_author_full_name: string | null;
  student_author_id: string | null;
  student_author_institute_id: string | null;
  student_author_institute_name: string | null;
  student_author_institute_short_name: string | null;
  student_author_is_verified: boolean | null;
  student_author_username: string | null;
  student_author_year: number | null;
};

const POST_MEDIA_BUCKET = 'post-media';
const EVENT_MEDIA_BUCKET = 'event-media';
const EVENT_R2_PREFIX = 'events/organizations/';

const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_BASE_URL
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '') ?? '';

export async function getHomeFeedPage({
  cursor = null,
  mode,
  pageSize = POSTS_PAGE_SIZE,
  userId,
}: {
  cursor?: HomeFeedCursor | null;
  mode: HomeFeedMode;
  pageSize?: number;
  userId: string;
}): Promise<HomeFeedPage> {
  const { data, error } = await supabase.rpc('get_home_feed_page', {
    page_cursor: cursor ?? undefined,
    feed_mode: mode,
    result_limit: pageSize,
  });

  if (error) {
    throw error;
  }

  const page = data as unknown as {
    items: HomeFeedRpcRow[];
    cursor: HomeFeedCursor | null;
    hasMore: boolean;
  };
  if (!page || !Array.isArray(page.items) || typeof page.hasMore !== 'boolean') {
    throw new Error('Invalid feed response. Please refresh.');
  }
  const items = await mapHomeFeedRows(page.items, userId);

  return {
    cursor: page.cursor,
    hasMore: page.hasMore,
    items,
  };
}

function mapHomeFeedRows(rows: HomeFeedRpcRow[], userId: string) {
  const postImagePaths = uniqueStrings(rows.map((row) => row.post_image_path));
  const lostFoundImagePaths = uniqueStrings(
    rows.map((row) => row.lost_found_image_path)
  );
  const eventCoverPaths = uniqueStrings(rows.map((row) => row.event_cover_path));
  const studentAvatarPaths = uniqueStrings(
    rows.map((row) => row.student_author_avatar_path)
  );
  const organizationAvatarPaths = uniqueStrings(
    rows.map((row) => row.organization_author_avatar_path)
  );
  const studentAuthorIds = uniqueStrings(rows.map((row) => row.student_author_id));

  return Promise.all([
    getPostMediaUrls(postImagePaths),
    getLostFoundMediaUrls(lostFoundImagePaths),
    getEventCoverUrls(eventCoverPaths),
    getSafeAvatarUrls(studentAvatarPaths),
    getSafeOrganizationAvatarUrls(organizationAvatarPaths),
    getPublicPrimaryBadges(studentAuthorIds),
  ]).then(
    ([
      postImageUrls,
      lostFoundImageUrls,
      eventCoverUrls,
      avatarUrls,
      organizationAvatarUrls,
      primaryBadges,
    ]) =>
      rows.flatMap((row) =>
        mapHomeFeedRow(
          row,
          postImageUrls,
          lostFoundImageUrls,
          eventCoverUrls,
          avatarUrls,
          organizationAvatarUrls,
          primaryBadges,
          userId
        )
      )
  );
}

function mapHomeFeedRow(
  row: HomeFeedRpcRow,
  postImageUrls: Map<string, string>,
  lostFoundImageUrls: Map<string, string>,
  eventCoverUrls: Map<string, string>,
  avatarUrls: Map<string, string>,
  organizationAvatarUrls: Map<string, string>,
  primaryBadges: Map<string, ProfileBadge>,
  userId: string
): HomeFeedItem[] {
  if (row.item_type === 'post') {
    const author = mapPostAuthor(row, avatarUrls, organizationAvatarUrls, primaryBadges);

    if (!row.post_id || !row.post_content || !row.post_created_at || !row.post_updated_at || !author) {
      return [];
    }

    return [
      {
        createdAt: row.sort_created_at,
        feedKey: `post:${row.post_id}`,
        itemType: 'post',
        post: {
          author,
          authorId: row.post_author_id,
          canDeleteByCurrentUser:
            row.post_author_id === userId || row.organization_can_manage_by_viewer,
          canEditByCurrentUser:
            row.post_author_id === userId || row.organization_can_manage_by_viewer,
          commentCount: Number(row.post_comment_count ?? 0),
          content: row.post_content,
          createdAt: row.post_created_at,
          id: row.post_id,
          imagePath: row.post_image_path,
          imageUrl: row.post_image_path
            ? postImageUrls.get(row.post_image_path) ?? null
            : null,
          isLikedByCurrentUser: row.post_is_liked_by_viewer,
          likeCount: Number(row.post_like_count ?? 0),
          lostFoundLocation: null,
          lostFoundResolvedAt: null,
          organizationAuthorId: row.post_organization_author_id,
          postKind: normalizePostKind(row.post_kind),
          updatedAt: row.post_updated_at,
        },
        score: row.ranking_score,
      },
    ];
  }

  if (row.item_type === 'lost_found') {
    const author = mapLostFoundAuthor(row, avatarUrls, organizationAvatarUrls);

    if (
      !row.lost_found_id ||
      !row.lost_found_title ||
      !row.lost_found_description ||
      !row.lost_found_created_at ||
      !row.lost_found_item_date ||
      !row.lost_found_updated_at ||
      !author
    ) {
      return [];
    }

    return [
      {
        createdAt: row.sort_created_at,
        feedKey: `lost-found:${row.lost_found_id}`,
        item: {
          author,
          campusLocation: row.lost_found_campus_location,
          canDeleteByCurrentUser:
            row.lost_found_created_by === userId ||
            row.organization_can_manage_by_viewer,
          canEditByCurrentUser:
            row.lost_found_created_by === userId ||
            row.organization_can_manage_by_viewer,
          category: normalizeLostFoundCategory(row.lost_found_category),
          createdAt: row.lost_found_created_at,
          createdBy: row.lost_found_created_by,
          description: row.lost_found_description,
          id: row.lost_found_id,
          imagePath: row.lost_found_image_path,
          imageUrl: row.lost_found_image_path
            ? lostFoundImageUrls.get(row.lost_found_image_path) ?? null
            : null,
          itemDate: row.lost_found_item_date,
          kind: normalizeLostFoundKind(row.lost_found_kind),
          organizationAuthorId: row.lost_found_organization_author_id,
          resolvedAt: row.lost_found_resolved_at,
          status: normalizeLostFoundStatus(row.lost_found_status),
          title: row.lost_found_title,
          updatedAt: row.lost_found_updated_at,
        },
        itemType: 'lost_found',
        score: row.ranking_score,
      },
    ];
  }

  if (row.item_type === 'event') {
    if (
      !row.event_id ||
      !row.event_created_by ||
      !row.event_description ||
      !row.event_location ||
      !row.event_organization_id ||
      !row.event_starts_at ||
      !row.event_status ||
      !row.event_title ||
      !row.event_university_id ||
      !row.organization_author_id ||
      !row.organization_author_name
    ) {
      return [];
    }

    return [
      {
        createdAt: row.sort_created_at,
        event: {
          coverPath: row.event_cover_path,
          coverUrl: row.event_cover_path
            ? eventCoverUrls.get(row.event_cover_path) ?? null
            : null,
          createdBy: row.event_created_by,
          description: row.event_description,
          endsAt: row.event_ends_at,
          id: row.event_id,
          instituteId: row.event_institute_id,
          interestedCount: Number(row.event_interested_count ?? 0),
          isInterested: row.event_is_interested_by_viewer ?? false,
          location: row.event_location,
          organization: {
            avatarPath: row.organization_author_avatar_path,
            avatarUrl: row.organization_author_avatar_path
              ? organizationAvatarUrls.get(row.organization_author_avatar_path) ??
                null
              : null,
            id: row.organization_author_id,
            isVerified: row.organization_author_is_verified ?? false,
            name: row.organization_author_name,
          },
          registrationUrl: row.event_registration_url,
          startsAt: row.event_starts_at,
          status: normalizeEventStatus(row.event_status),
          title: row.event_title,
          universityId: row.event_university_id,
        },
        feedKey: `event:${row.event_id}`,
        itemType: 'event',
        score: row.ranking_score,
      },
    ];
  }

  return [
    {
      createdAt: row.sort_created_at,
      feedKey: `${row.item_type}:${row.item_id}`,
      id: row.item_id,
      itemType: row.item_type === 'opportunity' ? 'opportunity' : 'announcement',
      score: row.ranking_score,
    },
  ];
}

function mapPostAuthor(
  row: HomeFeedRpcRow,
  avatarUrls: Map<string, string>,
  organizationAvatarUrls: Map<string, string>,
  primaryBadges: Map<string, ProfileBadge>
) {
  if (
    row.student_author_id &&
    row.student_author_institute_id &&
    row.student_author_branch !== null &&
    row.student_author_username !== null &&
    row.student_author_year !== null
  ) {
    return {
      avatarPath: row.student_author_avatar_path,
      avatarUrl: row.student_author_avatar_path
        ? avatarUrls.get(row.student_author_avatar_path) ?? null
        : null,
      branch: row.student_author_branch,
      fullName: row.student_author_full_name ?? 'Student',
      id: row.student_author_id,
      institute: {
        id: row.student_author_institute_id,
        name: row.student_author_institute_name ?? 'Campus',
        shortName: row.student_author_institute_short_name ?? 'Campus',
      },
      isVerified: row.student_author_is_verified ?? false,
      kind: 'student' as const,
      primaryBadge: primaryBadges.get(row.student_author_id) ?? null,
      username: row.student_author_username ?? 'student',
      year: row.student_author_year,
    };
  }

  if (row.organization_author_id && row.organization_author_name) {
    return {
      avatarPath: row.organization_author_avatar_path,
      avatarUrl: row.organization_author_avatar_path
        ? organizationAvatarUrls.get(row.organization_author_avatar_path) ?? null
        : null,
      campusShortName:
        row.organization_author_institute_short_name ??
        row.organization_author_university_short_name ??
        'Campus',
      fullName: row.organization_author_name,
      id: row.organization_author_id,
      isVerified: row.organization_author_is_verified ?? false,
      kind: 'organization' as const,
      primaryBadge: null,
    };
  }

  return null;
}

function mapLostFoundAuthor(
  row: HomeFeedRpcRow,
  avatarUrls: Map<string, string>,
  organizationAvatarUrls: Map<string, string>
) {
  if (row.student_author_id && row.student_author_institute_id) {
    return {
      avatarPath: row.student_author_avatar_path,
      avatarUrl: row.student_author_avatar_path
        ? avatarUrls.get(row.student_author_avatar_path) ?? null
        : null,
      fullName: row.student_author_full_name ?? 'Student',
      id: row.student_author_id,
      institute: {
        id: row.student_author_institute_id,
        short_name: row.student_author_institute_short_name ?? 'Campus',
      },
      isVerified: row.student_author_is_verified ?? false,
      kind: 'student' as const,
      username: row.student_author_username ?? 'student',
    };
  }

  if (row.organization_author_id && row.organization_author_name) {
    return {
      avatarPath: row.organization_author_avatar_path,
      avatarUrl: row.organization_author_avatar_path
        ? organizationAvatarUrls.get(row.organization_author_avatar_path) ?? null
        : null,
      campusShortName:
        row.organization_author_institute_short_name ??
        row.organization_author_university_short_name ??
        'Campus',
      fullName: row.organization_author_name,
      id: row.organization_author_id,
      isVerified: row.organization_author_is_verified ?? false,
      kind: 'organization' as const,
    };
  }

  return null;
}

function normalizePostKind(value: string | null): PostKind {
  return value === 'lost' || value === 'found' ? value : 'general';
}

function normalizeLostFoundCategory(value: string | null): LostFoundCategory {
  const knownCategories = [
    'accessories',
    'bags',
    'books_notes',
    'clothing',
    'electronics',
    'ids_cards',
    'keys',
    'other',
  ] as const;

  return knownCategories.includes(value as LostFoundCategory)
    ? (value as LostFoundCategory)
    : 'other';
}

function normalizeLostFoundKind(value: string | null): LostFoundKind {
  return value === 'found' ? 'found' : 'lost';
}

function normalizeLostFoundStatus(value: string | null): LostFoundStatus {
  return value === 'resolved' ? 'resolved' : 'active';
}

function normalizeEventStatus(value: string): EventStatus {
  if (
    value === 'draft' ||
    value === 'published' ||
    value === 'cancelled' ||
    value === 'completed'
  ) {
    return value;
  }

  return 'published';
}

function uniqueStrings(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function getPostMediaUrls(paths: string[]) {
  const urls = new Map<string, string>();
  const legacyPaths: string[] = [];

  for (const path of paths) {
    if (path.startsWith('posts/')) {
      addPublicMediaUrl(urls, path);
    } else {
      legacyPaths.push(path);
    }
  }

  await addLegacyUrls(urls, POST_MEDIA_BUCKET, legacyPaths, 'post media');
  return urls;
}

async function getLostFoundMediaUrls(paths: string[]) {
  const urls = new Map<string, string>();
  const legacyPaths: string[] = [];

  for (const path of paths) {
    if (path.startsWith('lost-found/') || path.startsWith('posts/')) {
      addPublicMediaUrl(urls, path);
    } else {
      legacyPaths.push(path);
    }
  }

  await addLegacyUrls(urls, POST_MEDIA_BUCKET, legacyPaths, 'lost and found media');
  return urls;
}

async function getEventCoverUrls(paths: string[]) {
  const urls = new Map<string, string>();
  const legacyPaths: string[] = [];

  for (const path of paths) {
    if (path.startsWith(EVENT_R2_PREFIX)) {
      addPublicMediaUrl(urls, path);
    } else {
      legacyPaths.push(path);
    }
  }

  await addLegacyUrls(urls, EVENT_MEDIA_BUCKET, legacyPaths, 'event cover');
  return urls;
}

function addPublicMediaUrl(urls: Map<string, string>, path: string) {
  if (!MEDIA_BASE_URL) {
    return;
  }

  urls.set(path, `${MEDIA_BASE_URL}/${path.trim().replace(/^\/+/, '')}`);
}

async function addLegacyUrls(
  urls: Map<string, string>,
  bucket: string,
  paths: string[],
  label: string
) {
  if (paths.length === 0) {
    return;
  }

  try {
    const signedUrls = await createPrivateImageUrls(bucket, paths);
    for (const [path, url] of signedUrls) {
      urls.set(path, url);
    }
  } catch (error) {
    console.warn(`[feed] Could not sign ${label} URLs.`, error);
  }
}

async function getSafeAvatarUrls(paths: string[]) {
  try {
    return await getAvatarUrls(paths);
  } catch (error) {
    console.warn('[feed] Could not sign avatar URLs.', error);
    return new Map<string, string>();
  }
}

async function getSafeOrganizationAvatarUrls(paths: string[]) {
  try {
    return await getOrganizationAvatarUrls(paths);
  } catch (error) {
    console.warn('[feed] Could not sign organization avatar URLs.', error);
    return new Map<string, string>();
  }
}
