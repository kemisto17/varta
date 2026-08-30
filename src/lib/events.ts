import type { QueryData } from '@supabase/supabase-js';
import type { ImagePickerAsset } from 'expo-image-picker';

import type {
  TablesInsert,
  TablesUpdate,
} from '../types/database';
import type {
  CampusEvent,
  EventCursor,
  EventDetail,
  EventFilter,
  EventFormValues,
  EventPage,
  EventStatus,
} from '../types/event';
import type {
  CampusOrganization,
  OrganizationRole,
} from '../types/organization';
import { optimizeEventCoverAsset } from './imageOptimization';
import {
  canEditOrganizationEvent,
  getFollowedOrganizationIds,
  getOrganizationAvatarUrls,
} from './organizations';
import {
  deleteEventImageFromR2,
  uploadEventImageToR2,
} from './r2';
import {
  createPrivateImageUrls,
  isImageUploadError,
} from './storage';
import { supabase } from './supabase';

export const EVENT_MEDIA_BUCKET =
  'event-media';

export const MAX_EVENT_COVER_SIZE =
  8 * 1024 * 1024;

export const EVENTS_PAGE_SIZE =
  20;

const EVENT_R2_PREFIX =
  'events/organizations/';

/*
 * The first page of the Following
 * events filter resolves the user's
 * followed organizations.
 *
 * Subsequent pagination requests reuse
 * that exact set instead of querying
 * organization follows again for every
 * page.
 */
const followedOrganizationIdsCache =
  new Map<string, string[]>();

const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_BASE_URL
    ?.trim()
    .replace(
      /^['"]|['"]$/g,
      ''
    )
    .replace(/\/+$/, '') ?? '';

const EVENT_SELECT = `
  id,
  university_id,
  institute_id,
  organization_id,
  created_by,
  title,
  description,
  location,
  starts_at,
  ends_at,
  registration_url,
  cover_path,
  status,
  organization:organizations!events_organization_id_fkey (
    id,
    name,
    avatar_path,
    is_verified
  )
` as const;

function selectEvents() {
  return supabase
    .from('events')
    .select(EVENT_SELECT);
}

type EventQueryRow =
  QueryData<
    ReturnType<
      typeof selectEvents
    >
  >[number];

export async function getCampusNowEvents(
  userId: string
) {
  const now =
    Date.now();

  const nowIso =
    new Date(
      now
    ).toISOString();

  /*
   * Events without an explicit end time
   * are treated elsewhere in the app as
   * lasting roughly two hours.
   *
   * Include those events if they started
   * within the last two hours.
   */
  const twoHoursAgoIso =
    new Date(
      now -
        2 *
          60 *
          60 *
          1000
    ).toISOString();

  const {
    data,
    error,
  } =
    await selectEvents()
      .eq(
        'status',
        'published'
      )
      .or(
        `starts_at.gte.${nowIso},ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${twoHoursAgoIso})`
      )
      .order(
        'starts_at',
        {
          ascending: true,
        }
      )
      .order(
        'id',
        {
          ascending: true,
        }
      )
      .limit(3);

  if (error) {
    throw error;
  }

  return mapEventRows(
    data,
    userId
  );
}

export async function getUpcomingDiscoveryEvents(
  userId: string,
  limit = 4
) {
  const nowIso =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await selectEvents()
      .eq(
        'status',
        'published'
      )
      .or(
        `starts_at.gte.${nowIso},ends_at.gte.${nowIso}`
      )
      .order(
        'starts_at',
        {
          ascending: true,
        }
      )
      .order(
        'id',
        {
          ascending: true,
        }
      )
      .limit(limit);

  if (error) {
    throw error;
  }

  return mapEventRows(
    data,
    userId
  );
}

export async function getEventsPage(
  {
    filter = 'all',
    instituteId = null,
    userId,
  }: {
    filter?: EventFilter;
    instituteId?: string | null;
    userId: string;
  },
  cursor:
    | EventCursor
    | null = null,
  pageSize =
    EVENTS_PAGE_SIZE
): Promise<EventPage> {
  const nowIso =
    new Date().toISOString();

  let query =
    selectEvents()
      .in(
        'status',
        [
          'published',
          'cancelled',
        ]
      )
      .or(
        `starts_at.gte.${nowIso},ends_at.gte.${nowIso}`
      )
      .order(
        'starts_at',
        {
          ascending: true,
        }
      )
      .order(
        'id',
        {
          ascending: true,
        }
      )
      .limit(
        pageSize + 1
      );

  if (
    filter ===
    'institute'
  ) {
    if (!instituteId) {
      return {
        cursor: null,
        events: [],
        hasMore: false,
      };
    }

    query =
      query.eq(
        'institute_id',
        instituteId
      );
  }

  if (
    filter ===
    'following'
  ) {
    /*
     * A request without a cursor is the
     * first page or an explicit refresh.
     *
     * Always resolve follows fresh for
     * page 1 so newly followed/unfollowed
     * organizations appear immediately.
     */
    let followedIds:
      string[];

    if (!cursor) {
      followedIds =
        await getFollowedOrganizationIds(
          userId
        );

      followedOrganizationIdsCache.set(
        userId,
        followedIds
      );
    } else {
      /*
       * Pagination should use the same
       * organization set as page 1.
       *
       * This avoids one extra Supabase
       * follows query for every page.
       */
      const cachedIds =
        followedOrganizationIdsCache.get(
          userId
        );

      if (cachedIds) {
        followedIds =
          cachedIds;
      } else {
        /*
         * Defensive fallback for cases
         * such as app reloads where a
         * cursor exists but the in-memory
         * cache no longer does.
         */
        followedIds =
          await getFollowedOrganizationIds(
            userId
          );

        followedOrganizationIdsCache.set(
          userId,
          followedIds
        );
      }
    }

    if (
      followedIds.length ===
      0
    ) {
      return {
        cursor: null,
        events: [],
        hasMore: false,
      };
    }

    query =
      query.in(
        'organization_id',
        followedIds
      );
  }

  if (cursor) {
    query =
      query.or(
        `starts_at.gt.${cursor.startsAt},and(starts_at.eq.${cursor.startsAt},id.gt.${cursor.id})`
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throw error;
  }

  return mapEventPage(
    data,
    userId,
    pageSize
  );
}

export async function getOrganizationUpcomingEvents(
  organizationId: string,
  userId: string
) {
  const nowIso =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await selectEvents()
      .eq(
        'organization_id',
        organizationId
      )
      .in(
        'status',
        [
          'published',
          'cancelled',
        ]
      )
      .or(
        `starts_at.gte.${nowIso},ends_at.gte.${nowIso}`
      )
      .order(
        'starts_at',
        {
          ascending: true,
        }
      )
      .limit(12);

  if (error) {
    throw error;
  }

  return mapEventRows(
    data,
    userId
  );
}

export async function getOrganizationProfileEvents(
  organizationId: string,
  userId: string
) {
  const {
    data,
    error,
  } =
    await selectEvents()
      .eq(
        'organization_id',
        organizationId
      )
      .in(
        'status',
        [
          'published',
          'cancelled',
        ]
      )
      .order(
        'starts_at',
        {
          ascending: false,
        }
      )
      .order(
        'id',
        {
          ascending: false,
        }
      )
      .limit(
        EVENTS_PAGE_SIZE
      );

  if (error) {
    throw error;
  }

  return mapEventRows(
    data,
    userId
  );
}

export async function getManagedOrganizationEvents(
  organizationId: string,
  userId: string,
  role: OrganizationRole
) {
  const {
    data,
    error,
  } =
    await selectEvents()
      .eq(
        'organization_id',
        organizationId
      )
      .order(
        'starts_at',
        {
          ascending: false,
        }
      )
      .limit(50);

  if (error) {
    throw error;
  }

  const events =
    await mapEventRows(
      data,
      userId
    );

  return events.map(
    (event) => ({
      ...event,

      canEdit:
        canEditOrganizationEvent(
          role,
          event.createdBy,
          userId
        ),

      role,
    })
  );
}

export async function getEventById(
  eventId: string,
  userId: string
): Promise<
  EventDetail | null
> {
  const {
    data,
    error,
  } =
    await selectEvents()
      .eq(
        'id',
        eventId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [event] =
    await mapEventRows(
      [data],
      userId
    );

  if (!event) {
    return null;
  }

  const {
    data: membership,
    error:
      membershipError,
  } =
    await supabase
      .from(
        'organization_members'
      )
      .select('role')
      .eq(
        'organization_id',
        event.organization.id
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle();

  if (
    membershipError
  ) {
    throw membershipError;
  }

  const role =
    toOrganizationRole(
      membership?.role
    );

  return {
    ...event,

    canManage:
      canEditOrganizationEvent(
        role,
        event.createdBy,
        userId
      ),

    role,
  };
}

export async function setEventInterest({
  eventId,
  isInterested,
  userId,
}: {
  eventId: string;
  isInterested: boolean;
  userId: string;
}) {
  const query =
    isInterested
      ? supabase
          .from(
            'event_interests'
          )
          .insert({
            event_id:
              eventId,
            user_id:
              userId,
          })
      : supabase
          .from(
            'event_interests'
          )
          .delete()
          .eq(
            'event_id',
            eventId
          )
          .eq(
            'user_id',
            userId
          );

  const { error } =
    await query;

  if (error) {
    throw error;
  }
}

export async function createOrganizationEvent({
  organization,
  userId,
  values,
}: {
  organization: Pick<
    CampusOrganization,
    | 'id'
    | 'instituteId'
    | 'universityId'
  >;
  userId: string;
  values: EventFormValues;
}) {
  validateEventValues(
    values
  );

  const eventInsert:
    TablesInsert<'events'> =
    {
      created_by:
        userId,

      description:
        values.description.trim(),

      ends_at:
        values.endsAt
          ?.toISOString() ??
        null,

      institute_id:
        organization.instituteId,

      location:
        values.location.trim(),

      organization_id:
        organization.id,

      registration_url:
        normalizeRegistrationUrl(
          values.registrationUrl
        ),

      starts_at:
        values.startsAt.toISOString(),

      status:
        'draft',

      title:
        values.title.trim(),

      university_id:
        organization.universityId,
    };

  const {
    data: draft,
    error: insertError,
  } =
    await supabase
      .from('events')
      .insert(
        eventInsert
      )
      .select('id')
      .single();

  if (insertError) {
    throw insertError;
  }

  let coverPath:
    | string
    | null = null;

  try {
    if (
      values.coverAsset
    ) {
      const upload =
        await uploadEventCover(
          {
            asset:
              values.coverAsset,
            eventId:
              draft.id,
            organizationId:
              organization.id,
          }
        );

      coverPath =
        upload.objectKey;

      const {
        error:
          coverError,
      } =
        await supabase
          .from('events')
          .update({
            cover_path:
              coverPath,
          })
          .eq(
            'id',
            draft.id
          );

      if (coverError) {
        throw coverError;
      }
    }

    const {
      data: published,
      error:
        publishError,
    } =
      await supabase
        .from('events')
        .update({
          status:
            'published',
        })
        .eq(
          'id',
          draft.id
        )
        .select('id')
        .single();

    if (
      publishError
    ) {
      throw publishError;
    }

    return published;
  } catch (error) {
    const reconciliation =
      await supabase
        .from('events')
        .select('id, status')
        .eq('id', draft.id)
        .maybeSingle();

    if (
      !reconciliation.error &&
      reconciliation.data?.status ===
        'published'
    ) {
      return {
        id: reconciliation.data.id,
      };
    }

    if (reconciliation.error) {
      console.warn(
        '[events] Event creation outcome is ambiguous; preserving the draft and cover.',
        reconciliation.error
      );

      throw error;
    }

    if (
      !reconciliation.data ||
      reconciliation.data.status !==
        'draft'
    ) {
      throw error;
    }

    /*
     * Delete R2 media before deleting
     * the event row.
     *
     * Event-level authorization in the
     * Edge Function requires the event
     * row to still exist.
     */
    if (coverPath) {
      try {
        await deleteEventCover(
          {
            eventId:
              draft.id,
            organizationId:
              organization.id,
            path:
              coverPath,
          }
        );
      } catch (
        cleanupError
      ) {
        console.warn(
          '[events] Could not clean up failed event cover.',
          cleanupError
        );
      }
    }

    await supabase
      .from('events')
      .delete()
      .eq(
        'id',
        draft.id
      )
      .eq(
        'status',
        'draft'
      );

    throw error;
  }
}

export async function updateOrganizationEvent({
  event,
  values,
}: {
  event: CampusEvent;
  values: EventFormValues;
}) {
  validateEventValues(
    values
  );

  let nextCoverPath =
    event.coverPath;

  let uploadedPath:
    | string
    | null = null;

  if (
    values.coverAsset
  ) {
    const upload =
      await uploadEventCover(
        {
          asset:
            values.coverAsset,
          eventId:
            event.id,
          organizationId:
            event.organization.id,
        }
      );

    nextCoverPath =
      upload.objectKey;

    uploadedPath =
      upload.objectKey;
  }

  const update:
    TablesUpdate<'events'> =
    {
      cover_path:
        nextCoverPath,

      description:
        values.description.trim(),

      ends_at:
        values.endsAt
          ?.toISOString() ??
        null,

      location:
        values.location.trim(),

      registration_url:
        normalizeRegistrationUrl(
          values.registrationUrl
        ),

      starts_at:
        values.startsAt.toISOString(),

      title:
        values.title.trim(),
    };

  const updateResult =
    await supabase
      .from('events')
      .update(update)
      .eq(
        'id',
        event.id
      )
      .select('id')
      .single();

  let data =
    updateResult.data;

  if (updateResult.error) {
    const reconciliation =
      await supabase
        .from('events')
        .select(
          'id, cover_path, description, ends_at, location, registration_url, starts_at, title'
        )
        .eq('id', event.id)
        .maybeSingle();

    if (
      reconciliation.data &&
      eventMatchesUpdate(
        reconciliation.data,
        update
      )
    ) {
      data = {
        id: reconciliation.data.id,
      };
    } else {
      if (
        uploadedPath &&
        !reconciliation.error
      ) {
        try {
          await deleteEventCover(
            {
              eventId:
                event.id,
              organizationId:
                event.organization.id,
              path:
                uploadedPath,
            }
          );
        } catch (
          cleanupError
        ) {
          console.warn(
            '[events] Could not clean up failed event cover upload.',
            cleanupError
          );
        }
      } else if (
        uploadedPath &&
        reconciliation.error
      ) {
        console.warn(
          '[events] Event update outcome is ambiguous; preserving the new cover.',
          reconciliation.error
        );
      }

      throw updateResult.error;
    }
  }

  if (!data) {
    throw new Error(
      'The updated event could not be loaded.'
    );
  }

  /*
   * DB now points to the new cover.
   * Old media can safely be removed.
   */
  if (
    uploadedPath &&
    event.coverPath &&
    event.coverPath !==
      uploadedPath
  ) {
    try {
      await deleteEventCover(
        {
          eventId:
            event.id,
          organizationId:
            event.organization.id,
          path:
            event.coverPath,
        }
      );
    } catch (
      cleanupError
    ) {
      /*
       * Do not fail the successful
       * event update because cleanup
       * failed. This merely leaves an
       * orphaned object for later
       * cleanup.
       */
      console.warn(
        '[events] Could not remove previous event cover.',
        cleanupError
      );
    }
  }

  return data;
}

function eventMatchesUpdate(
  event: {
    cover_path: string | null;
    description: string;
    ends_at: string | null;
    location: string;
    registration_url: string | null;
    starts_at: string;
    title: string;
  },
  update: TablesUpdate<'events'>
) {
  return (
    event.cover_path === update.cover_path &&
    event.description === update.description &&
    event.ends_at === update.ends_at &&
    event.location === update.location &&
    event.registration_url ===
      update.registration_url &&
    event.starts_at === update.starts_at &&
    event.title === update.title
  );
}

export async function cancelOrganizationEvent(
  eventId: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from('events')
      .update({
        status:
          'cancelled',
      })
      .eq(
        'id',
        eventId
      )
      .neq(
        'status',
        'cancelled'
      )
      .select('id')
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteDraftEvent(
  event: CampusEvent
) {
  if (
    event.status !==
    'draft'
  ) {
    throw new Error(
      'Published events should be cancelled, not deleted.'
    );
  }

  /*
   * R2 deletion authorization needs
   * the event row to exist, so delete
   * its cover first.
   */
  if (event.coverPath) {
    try {
      await deleteEventCover(
        {
          eventId:
            event.id,
          organizationId:
            event.organization.id,
          path:
            event.coverPath,
        }
      );
    } catch (
      cleanupError
    ) {
      console.warn(
        '[events] Could not remove draft event cover.',
        cleanupError
      );
    }
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('events')
      .delete()
      .eq(
        'id',
        event.id
      )
      .eq(
        'status',
        'draft'
      )
      .select('id')
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export function getEventErrorMessage(
  error: unknown
) {
  if (
    isImageUploadError(
      error
    )
  ) {
    return error.message;
  }

  if (
    error instanceof
      Error
  ) {
    if (
      error.message.startsWith(
        'Event title'
      ) ||
      error.message.startsWith(
        'Choose an event'
      ) ||
      error.message.startsWith(
        'End time'
      ) ||
      error.message.startsWith(
        'Registration links'
      ) ||
      error.message.startsWith(
        'Published events'
      ) ||
      error.message.startsWith(
        'Image upload failed'
      )
    ) {
      return error.message;
    }
  }

  return 'Something went wrong. Check your connection and try again.';
}

async function uploadEventCover({
  asset,
  eventId,
  organizationId,
}: {
  asset: ImagePickerAsset;
  eventId: string;
  organizationId: string;
}) {
  if (
    asset.fileSize &&
    asset.fileSize >
      MAX_EVENT_COVER_SIZE
  ) {
    throw new Error(
      'Choose an image smaller than 8 MB.'
    );
  }

  const optimizedAsset =
    await optimizeEventCoverAsset(
      asset
    );

  return uploadEventImageToR2({
    asset: optimizedAsset,
    eventId,
    organizationId,
  });
}

async function deleteEventCover({
  eventId,
  organizationId,
  path,
}: {
  eventId: string;
  organizationId: string;
  path: string;
}) {
  const cleanPath =
    path.trim();

  if (
    isR2EventCoverPath(
      cleanPath
    )
  ) {
    const expectedPrefix =
      `${EVENT_R2_PREFIX}${organizationId}/${eventId}/`;

    if (
      !cleanPath.startsWith(
        expectedPrefix
      )
    ) {
      throw new Error(
        'The event cover path does not belong to this event.'
      );
    }

    await deleteEventImageFromR2(
      {
        eventId,
        objectKey:
          cleanPath,
        organizationId,
      }
    );

    return;
  }

  /*
   * Legacy Supabase event cover format:
   *
   * <organizationId>/<filename>
   */
  if (
    !cleanPath.startsWith(
      `${organizationId}/`
    )
  ) {
    throw new Error(
      'The event cover path does not belong to this organization.'
    );
  }

  const {
    error,
  } =
    await supabase.storage
      .from(
        EVENT_MEDIA_BUCKET
      )
      .remove([
        cleanPath,
      ]);

  if (error) {
    throw error;
  }
}

async function mapEventPage(
  rows: EventQueryRow[],
  userId: string,
  pageSize: number
): Promise<EventPage> {
  const pageRows =
    rows.slice(
      0,
      pageSize
    );

  const events =
    await mapEventRows(
      pageRows,
      userId
    );

  const lastEvent =
    events.at(-1) ??
    null;

  return {
    cursor:
      lastEvent
        ? {
            id:
              lastEvent.id,
            startsAt:
              lastEvent.startsAt,
          }
        : null,

    events,

    hasMore:
      rows.length >
      pageSize,
  };
}

async function mapEventRows(
  rows: EventQueryRow[],
  userId: string
) {
  const paths =
    rows
      .map(
        (row) =>
          row.cover_path
      )
      .filter(
        (
          path
        ): path is string =>
          path !== null
      );

  const eventIds =
    rows.map(
      (row) =>
        row.id
    );

  const organizationAvatarPaths =
    rows
      .map(
        (row) =>
          row.organization
            ?.avatar_path ??
          null
      )
      .filter(
        (
          path
        ): path is string =>
          path !== null
      );

  const [
    coverUrls,
    organizationAvatarUrls,
    interestedIds,
  ] =
    await Promise.all([
      getEventCoverUrls(
        paths
      ),

      getSafeEventOrganizationAvatarUrls(
        organizationAvatarPaths
      ),

      getInterestedEventIds(
        eventIds,
        userId
      ),
    ]);

  return rows.flatMap(
    (row) => {
      if (
        !row.organization ||
        !isEventStatus(
          row.status
        )
      ) {
        return [];
      }

      return [
        {
          coverPath:
            row.cover_path,

          coverUrl:
            row.cover_path
              ? coverUrls.get(
                  row.cover_path
                ) ??
                null
              : null,

          createdBy:
            row.created_by,

          description:
            row.description,

          endsAt:
            row.ends_at,

          id:
            row.id,

          instituteId:
            row.institute_id,

          isInterested:
            interestedIds.has(
              row.id
            ),

          location:
            row.location,

          organization: {
            avatarPath:
              row.organization
                .avatar_path,

            avatarUrl:
              row.organization
                .avatar_path
                ? organizationAvatarUrls.get(
                    row.organization
                      .avatar_path
                  ) ?? null
                : null,

            id:
              row.organization
                .id,

            isVerified:
              row.organization
                .is_verified,

            name:
              row.organization
                .name,
          },

          registrationUrl:
            row.registration_url,

          startsAt:
            row.starts_at,

          status:
            row.status,

          title:
            row.title,

          universityId:
            row.university_id,
        },
      ];
    }
  );
}

async function getSafeEventOrganizationAvatarUrls(
  paths: string[]
) {
  try {
    return await getOrganizationAvatarUrls(
      paths
    );
  } catch (error) {
    console.warn(
      '[events] Could not load organization avatars.',
      error
    );

    return new Map<
      string,
      string
    >();
  }
}

async function getEventCoverUrls(
  paths: string[]
) {
  const urls =
    new Map<
      string,
      string
    >();

  const uniquePaths = [
    ...new Set(paths),
  ];

  const r2Paths =
    uniquePaths.filter(
      isR2EventCoverPath
    );

  const legacyPaths =
    uniquePaths.filter(
      (path) =>
        !isR2EventCoverPath(
          path
        )
    );

  for (
    const path
    of r2Paths
  ) {
    try {
      urls.set(
        path,
        getR2EventCoverUrl(
          path
        )
      );
    } catch (error) {
      console.warn(
        '[events] Could not build R2 event cover URL.',
        error
      );
    }
  }

  if (
    legacyPaths.length >
    0
  ) {
    try {
      const legacyUrls =
        await createPrivateImageUrls(
          EVENT_MEDIA_BUCKET,
          legacyPaths
        );

      for (
        const [
          path,
          url,
        ]
        of legacyUrls
      ) {
        urls.set(
          path,
          url
        );
      }
    } catch (error) {
      console.warn(
        '[events] Could not sign legacy event cover URLs.',
        error
      );
    }
  }

  return urls;
}

function isR2EventCoverPath(
  path: string
) {
  return path.startsWith(
    EVENT_R2_PREFIX
  );
}

function getR2EventCoverUrl(
  path: string
) {
  if (
    !MEDIA_BASE_URL
  ) {
    throw new Error(
      'Missing EXPO_PUBLIC_MEDIA_BASE_URL.'
    );
  }

  const cleanPath =
    path
      .trim()
      .replace(
        /^\/+/,
        ''
      );

  return `${MEDIA_BASE_URL}/${cleanPath}`;
}

async function getInterestedEventIds(
  eventIds: string[],
  userId: string
) {
  if (
    eventIds.length ===
    0
  ) {
    return new Set<
      string
    >();
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'event_interests'
      )
      .select(
        'event_id'
      )
      .eq(
        'user_id',
        userId
      )
      .in(
        'event_id',
        eventIds
      );

  if (error) {
    throw error;
  }

  return new Set(
    data.map(
      (interest) =>
        interest.event_id
    )
  );
}


function validateEventValues(
  values: EventFormValues
) {
  const titleLength =
    values.title
      .trim()
      .length;

  if (
    titleLength < 3 ||
    titleLength > 120
  ) {
    throw new Error(
      'Event title must be between 3 and 120 characters.'
    );
  }

  if (
    values.description
      .length > 5000
  ) {
    throw new Error(
      'Choose an event description under 5,000 characters.'
    );
  }

  if (
    values.location
      .length > 160
  ) {
    throw new Error(
      'Choose an event location under 160 characters.'
    );
  }

  if (
    Number.isNaN(
      values.startsAt.getTime()
    )
  ) {
    throw new Error(
      'Choose an event start date and time.'
    );
  }

  if (
    values.endsAt &&
    values.endsAt <=
      values.startsAt
  ) {
    throw new Error(
      'End time must be after the start time.'
    );
  }

  normalizeRegistrationUrl(
    values.registrationUrl
  );
}

function normalizeRegistrationUrl(
  value: string
) {
  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  try {
    const url =
      new URL(
        normalized
      );

    if (
      url.protocol !==
      'https:'
    ) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error(
      'Registration links must be valid HTTPS links.'
    );
  }
}

function isEventStatus(
  value: string
): value is EventStatus {
  return (
    value === 'draft' ||
    value ===
      'published' ||
    value ===
      'cancelled' ||
    value ===
      'completed'
  );
}

function toOrganizationRole(
  value:
    | string
    | undefined
): OrganizationRole | null {
  return (
    value === 'owner' ||
    value === 'admin' ||
    value === 'editor'
  )
    ? value
    : null;
}
