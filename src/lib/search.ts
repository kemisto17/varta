import { getAvatarUrls } from './avatars';
import {
  getUpcomingDiscoveryEvents,
} from './events';
import {
  getOrganizationAvatarUrls,
} from './organizations';
import { supabase } from './supabase';

import type { Database } from '../types/database';
import type {
  DiscoveryResults,
  SearchEvent,
  SearchOrganization,
  SearchPerson,
  SearchResults,
} from '../types/search';

export const MIN_SEARCH_CHARACTERS =
  2;

export const SEARCH_RESULT_LIMIT =
  8;

type OrganizationSearchRow =
  Database['public']['Functions']['search_organizations']['Returns'][number];

type DiscoveryOrganizationRow =
  Database['public']['Functions']['get_discovery_organizations']['Returns'][number];

const EMPTY_RESULTS: SearchResults =
  {
    events: [],
    organizations: [],
    people: [],
  };

export async function searchVarta(
  rawQuery: string,
  signal?: AbortSignal
): Promise<SearchResults> {
  const searchQuery =
    normalizeSearchQuery(
      rawQuery
    );

  if (
    searchQuery.length <
    MIN_SEARCH_CHARACTERS
  ) {
    return EMPTY_RESULTS;
  }

  const activeSignal =
    signal ??
    new AbortController()
      .signal;

  /*
   * Search all three categories in
   * parallel.
   *
   * Each RPC has its own small result
   * limit, so we never download an
   * unbounded result set.
   */
  const [
    peopleResult,
    organizationResult,
    eventResult,
  ] =
    await Promise.all([
      supabase
        .rpc(
          'search_people',
          {
            result_limit:
              SEARCH_RESULT_LIMIT,

            search_query:
              searchQuery,
          }
        )
        .abortSignal(
          activeSignal
        ),

      supabase
        .rpc(
          'search_organizations',
          {
            result_limit:
              SEARCH_RESULT_LIMIT,

            search_query:
              searchQuery,
          }
        )
        .abortSignal(
          activeSignal
        ),

      supabase
        .rpc(
          'search_events',
          {
            result_limit:
              SEARCH_RESULT_LIMIT,

            search_query:
              searchQuery,
          }
        )
        .abortSignal(
          activeSignal
        ),
    ]);

  const error =
    peopleResult.error ??
    organizationResult.error ??
    eventResult.error;

  if (error) {
    throw error;
  }

  if (
    signal?.aborted
  ) {
    throw createAbortError();
  }

  const peopleRows =
    peopleResult.data ?? [];

  const eventRows =
    eventResult.data ?? [];

  const organizationRows =
    organizationResult.data ??
    [];

  /*
   * Only resolve images that the
   * Explore search UI actually shows.
   *
   * Search event rows are rendered
   * using a date tile, not their cover
   * images. Resolving up to eight event
   * cover URLs on every search would
   * therefore be wasted work.
   */
  const [
    avatarUrls,
    organizationAvatarUrls,
  ] =
    await Promise.all([
      getSearchAvatarUrls(
        peopleRows.flatMap(
          (row) =>
            row.avatar_path
              ? [
                  row.avatar_path,
                ]
              : []
        )
      ),

      getSearchOrganizationAvatarUrls(
        organizationRows.flatMap(
          (row) =>
            row.avatar_path
              ? [
                  row.avatar_path,
                ]
              : []
        )
      ),
    ]);

  if (
    signal?.aborted
  ) {
    throw createAbortError();
  }

  return {
    events:
      eventRows.map(
        (
          row
        ): SearchEvent => ({
          /*
           * Keep the stored path in the
           * search model in case a
           * future screen needs it, but
           * don't resolve a URL here.
           */
          coverPath:
            row.cover_path ??
            null,

          coverUrl:
            null,

          ends_at:
            row.ends_at ??
            null,

          id:
            row.id,

          location:
            row.location ??
            '',

          organization_id:
            row.organization_id,

          organization_is_verified:
            row.organization_is_verified,

          organization_name:
            row.organization_name,

          starts_at:
            row.starts_at,

          title:
            row.title,
        })
      ),

    organizations:
      organizationRows.map(
        (row) =>
          mapOrganizationRow(
            row,
            organizationAvatarUrls
          )
      ),

    people:
      peopleRows.map(
        (
          row
        ): SearchPerson => ({
          avatarPath:
            row.avatar_path ??
            null,

          avatarUrl:
            row.avatar_path
              ? avatarUrls.get(
                  row.avatar_path
                ) ?? null
              : null,

          branch:
            row.branch,

          full_name:
            row.full_name,

          id:
            row.id,

          institute_name:
            row.institute_name,

          institute_short_name:
            row.institute_short_name,

          is_verified:
            row.is_verified,

          username:
            row.username,

          year:
            row.year,
        })
      ),
  };
}

export async function getVartaDiscovery(
  userId: string
): Promise<DiscoveryResults> {
  /*
   * Organization discovery and event
   * discovery are independent, so keep
   * them parallel.
   */
  const [
    organizationResult,
    events,
  ] =
    await Promise.all([
      supabase.rpc(
        'get_discovery_organizations',
        {
          result_limit: 5,
        }
      ),

      getUpcomingDiscoveryEvents(
        userId,
        4
      ),
    ]);

  if (
    organizationResult.error
  ) {
    throw organizationResult.error;
  }

  const organizationRows =
    organizationResult.data ??
    [];

  const organizationAvatarUrls =
    await getSearchOrganizationAvatarUrls(
      organizationRows.flatMap(
        (row) =>
          row.avatar_path
            ? [
                row.avatar_path,
              ]
            : []
      )
    );

  return {
    events,

    organizations:
      organizationRows.map(
        (row) =>
          mapOrganizationRow(
            row,
            organizationAvatarUrls
          )
      ),
  };
}

export function normalizeSearchQuery(
  value: string
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
    .slice(
      0,
      80
    );
}

export function getSearchErrorMessage() {
  return 'Search is unavailable right now. Check your connection and try again.';
}

function createAbortError() {
  const error =
    new Error(
      'Search was cancelled.'
    );

  error.name =
    'AbortError';

  return error;
}

function mapOrganizationRow(
  row:
    | OrganizationSearchRow
    | DiscoveryOrganizationRow,
  avatarUrls:
    Map<string, string>
): SearchOrganization {
  return {
    avatarPath:
      row.avatar_path ??
      null,

    avatarUrl:
      row.avatar_path
        ? avatarUrls.get(
            row.avatar_path
          ) ?? null
        : null,

    description:
      row.description ??
      '',

    id:
      row.id,

    institute_name:
      row.institute_name ??
      '',

    institute_short_name:
      row.institute_short_name ??
      '',

    is_verified:
      row.is_verified,

    name:
      row.name,

    slug:
      row.slug,
  };
}

async function getSearchOrganizationAvatarUrls(
  paths: string[]
) {
  try {
    return await getOrganizationAvatarUrls(
      [
        ...new Set(
          paths
        ),
      ]
    );
  } catch (error) {
    console.warn(
      '[search] Could not load organization images.',
      error
    );

    return new Map<
      string,
      string
    >();
  }
}

async function getSearchAvatarUrls(
  paths: string[]
) {
  try {
    return await getAvatarUrls(
      [
        ...new Set(
          paths
        ),
      ]
    );
  } catch (error) {
    console.warn(
      '[search] Could not load profile images.',
      error
    );

    return new Map<
      string,
      string
    >();
  }
}