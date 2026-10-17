import { createContext } from 'react';

import type { AccountModeration } from '../lib/accountModeration';
import type { Tables } from '../types/database';

export type Profile = Tables<'profiles'>;

export type ProfileStatus = 'idle' | 'loading' | 'missing' | 'ready' | 'error';

export type ProfileContextValue = {
  accountModeration: AccountModeration;
  errorMessage: string | null;
  markProfileCreated: (profile: Profile) => void;
  profile: Profile | null;
  refreshProfile: () => void;
  status: ProfileStatus;
};

export const ProfileContext = createContext<ProfileContextValue | undefined>(
  undefined
);
