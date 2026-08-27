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
  const resolvedUserId = useRef<string | null>(null);
  const statusRef = useRef<ProfileStatus>('idle');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [status, setStatus] = useState<ProfileStatus>('idle');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;

    if (!userId) {
      resolvedUserId.current = null;
      statusRef.current = 'idle';
      setProfile(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    const isBackgroundRefresh =
      resolvedUserId.current === userId &&
      statusRef.current !== 'idle' &&
      statusRef.current !== 'loading' &&
      statusRef.current !== 'error';

    if (!isBackgroundRefresh) {
      statusRef.current = 'loading';
      setStatus('loading');
    }

    setErrorMessage(null);

    const loadProfile = async () => {
      try {
        const nextProfile = await getStudentProfile(userId);

        if (requestId.current !== activeRequestId) {
          return;
        }

        const nextStatus = nextProfile ? 'ready' : 'missing';

        resolvedUserId.current = userId;
        statusRef.current = nextStatus;
        setProfile(nextProfile);
        setStatus(nextStatus);
      } catch {
        if (requestId.current !== activeRequestId) {
          return;
        }

        if (!isBackgroundRefresh) {
          resolvedUserId.current = null;
          statusRef.current = 'error';
          setProfile(null);
          setStatus('error');
        }

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
    resolvedUserId.current = nextProfile.id;
    statusRef.current = 'ready';
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
