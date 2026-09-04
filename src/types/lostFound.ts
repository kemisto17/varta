import type { Tables } from './database';

type InstituteRow = Tables<'institutes'>;
type LostFoundRow = Tables<'lost_found_items'>;
type ProfileRow = Tables<'profiles'>;

export const LOST_FOUND_CATEGORIES = [
  { label: 'Accessories', value: 'accessories' },
  { label: 'Bags', value: 'bags' },
  { label: 'Books & notes', value: 'books_notes' },
  { label: 'Clothing', value: 'clothing' },
  { label: 'Electronics', value: 'electronics' },
  { label: 'IDs & cards', value: 'ids_cards' },
  { label: 'Keys', value: 'keys' },
  { label: 'Other', value: 'other' },
] as const;

export type LostFoundCategory =
  (typeof LOST_FOUND_CATEGORIES)[number]['value'];

export type LostFoundKind = 'lost' | 'found';
export type LostFoundStatus = 'active' | 'resolved';
export type LostFoundFilter = 'all' | 'lost' | 'found' | 'resolved';

export type LostFoundStudentAuthor = {
  avatarPath: ProfileRow['avatar_path'];
  avatarUrl: string | null;
  fullName: ProfileRow['full_name'];
  id: ProfileRow['id'];
  institute: Pick<InstituteRow, 'id' | 'short_name'>;
  isVerified: boolean;
  kind: 'student';
  username: ProfileRow['username'];
};

export type LostFoundOrganizationAuthor = {
  avatarPath: string | null;
  avatarUrl: string | null;
  campusShortName: string;
  fullName: string;
  id: string;
  isVerified: boolean;
  kind: 'organization';
};

export type LostFoundAuthor =
  | LostFoundStudentAuthor
  | LostFoundOrganizationAuthor;

export type LostFoundItem = {
  author: LostFoundAuthor;
  campusLocation: LostFoundRow['campus_location'];
  canDeleteByCurrentUser: boolean;
  canEditByCurrentUser: boolean;
  category: LostFoundCategory;
  createdAt: LostFoundRow['created_at'];
  createdBy: LostFoundRow['created_by'];
  description: LostFoundRow['description'];
  id: LostFoundRow['id'];
  imagePath: LostFoundRow['image_path'];
  imageUrl: string | null;
  itemDate: LostFoundRow['item_date'];
  kind: LostFoundKind;
  organizationAuthorId: LostFoundRow['organization_author_id'];
  resolvedAt: LostFoundRow['resolved_at'];
  status: LostFoundStatus;
  title: LostFoundRow['title'];
  updatedAt: LostFoundRow['updated_at'];
};

export type LostFoundCursor = Pick<LostFoundItem, 'createdAt' | 'id'>;

export type LostFoundDraft = {
  campusLocation: string;
  category: LostFoundCategory;
  description: string;
  itemDate: string;
  kind: LostFoundKind;
  title: string;
};
