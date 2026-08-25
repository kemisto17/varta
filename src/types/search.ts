import type { Database } from './database';
import type { CampusEvent } from './event';

type PeopleRow =
  Database['public']['Functions']['search_people']['Returns'][number];
type OrganizationRow =
  Database['public']['Functions']['search_organizations']['Returns'][number];
type EventRow =
  Database['public']['Functions']['search_events']['Returns'][number];

export type SearchPerson = Pick<
  PeopleRow,
  | 'branch'
  | 'full_name'
  | 'id'
  | 'institute_name'
  | 'institute_short_name'
  | 'is_verified'
  | 'username'
  | 'year'
> & {
  avatarPath: string | null;
  avatarUrl: string | null;
};

export type SearchOrganization = Pick<
  OrganizationRow,
  | 'description'
  | 'id'
  | 'institute_name'
  | 'institute_short_name'
  | 'is_verified'
  | 'name'
  | 'slug'
> & {
  avatarPath: string | null;
  avatarUrl: string | null;
};

export type SearchEvent = Pick<
  EventRow,
  | 'id'
  | 'location'
  | 'organization_id'
  | 'organization_is_verified'
  | 'organization_name'
  | 'starts_at'
  | 'title'
> & {
  coverPath: string | null;
  coverUrl: string | null;
  ends_at: string | null;
};

export type SearchResults = {
  events: SearchEvent[];
  organizations: SearchOrganization[];
  people: SearchPerson[];
};

export type DiscoveryResults = {
  events: CampusEvent[];
  organizations: SearchOrganization[];
};
