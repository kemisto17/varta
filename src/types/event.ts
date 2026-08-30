import type { Tables } from './database';
import type { OrganizationRole } from './organization';

type EventRow = Tables<'events'>;

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type EventFilter = 'all' | 'institute' | 'following';

export type CampusEvent = {
  coverPath: EventRow['cover_path'];
  coverUrl: string | null;
  createdBy: EventRow['created_by'];
  description: EventRow['description'];
  endsAt: EventRow['ends_at'];
  id: EventRow['id'];
  instituteId: EventRow['institute_id'];
  isInterested: boolean;
  location: EventRow['location'];
  organization: {
    avatarPath: string | null;
    avatarUrl: string | null;
    id: string;
    isVerified: boolean;
    name: string;
  };
  registrationUrl: EventRow['registration_url'];
  startsAt: EventRow['starts_at'];
  status: EventStatus;
  title: EventRow['title'];
  universityId: EventRow['university_id'];
};

export type EventCursor = Pick<CampusEvent, 'id' | 'startsAt'>;

export type EventPage = {
  cursor: EventCursor | null;
  events: CampusEvent[];
  hasMore: boolean;
};

export type ManageableEvent = CampusEvent & {
  canEdit: boolean;
  role: OrganizationRole;
};

export type EventDetail = CampusEvent & {
  canManage: boolean;
  role: OrganizationRole | null;
};

export type EventFormValues = {
  coverAsset: import('expo-image-picker').ImagePickerAsset | null;
  description: string;
  endsAt: Date | null;
  location: string;
  registrationUrl: string;
  startsAt: Date;
  title: string;
};
