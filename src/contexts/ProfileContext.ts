import { createContext } from 'react';

import type { Tables } from '../types/database';

export type Profile = Tables<'profiles'>;

export type ProfileStatus = 'idle' | 'loading' | 'missing' | 'ready' | 'error';

export type ProfileContextValue = {
  continueToApp: () => void;
  errorMessage: string | null;
  markProfileCreated: (profile: Profile) => void;
  profile: Profile | null;
  refreshProfile: () => void;
  shouldShowVerificationPending: boolean;
  status: ProfileStatus;
};

export const ProfileContext = createContext<ProfileContextValue | undefined>(
  undefined
);
