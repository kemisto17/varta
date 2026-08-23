import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Profile, ProfileStatus } from '../contexts/ProfileContext';
import { ProfileContext } from '../contexts/ProfileContext';
import { useAuth } from '../hooks/useAuth';
import { getStudentProfile } from '../lib/profile';

export function ProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const requestId = useRef(0);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [status, setStatus] = useState<ProfileStatus>('idle');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;

    if (!userId) {
      setProfile(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    const loadProfile = async () => {
      try {
        const nextProfile = await getStudentProfile(userId);

        if (requestId.current !== activeRequestId) {
          return;
        }

        setProfile(nextProfile);
        setStatus(nextProfile ? 'ready' : 'missing');
      } catch {
        if (requestId.current !== activeRequestId) {
          return;
        }

        setProfile(null);
        setStatus('error');
        setErrorMessage(
          'We could not check your profile. Check your connection and try again.'
        );
      }
    };

    void loadProfile();
  }, [refreshIndex, userId]);

  const refreshProfile = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  const markProfileCreated = useCallback((nextProfile: Profile) => {
    requestId.current += 1;
    setProfile(nextProfile);
    setStatus('ready');
    setErrorMessage(null);
  }, []);

  const value = useMemo(
    () => ({
      errorMessage,
      markProfileCreated,
      profile,
      refreshProfile,
      status,
    }),
    [
      errorMessage,
      markProfileCreated,
      profile,
      refreshProfile,
      status,
    ]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}
