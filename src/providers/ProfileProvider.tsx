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
  const [stateUserId, setStateUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('idle');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;

    if (!userId) {
      resolvedUserId.current = null;
      setStateUserId(null);
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
        setStateUserId(userId);
        statusRef.current = nextStatus;
        setProfile(nextProfile);
        setStatus(nextStatus);
      } catch {
        if (requestId.current !== activeRequestId) {
          return;
        }

        if (!isBackgroundRefresh) {
          resolvedUserId.current = userId;
          setStateUserId(userId);
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
    if (nextProfile.id !== userId) {
      return;
    }

    requestId.current += 1;
    resolvedUserId.current = nextProfile.id;
    setStateUserId(nextProfile.id);
    statusRef.current = 'ready';
    setProfile(nextProfile);
    setStatus('ready');
    setErrorMessage(null);
  }, [userId]);

  const isCurrentUserState = stateUserId === userId;
  const exposedProfile = isCurrentUserState ? profile : null;
  const exposedStatus: ProfileStatus = !userId
    ? 'idle'
    : isCurrentUserState
      ? status
      : 'loading';
  const exposedErrorMessage = isCurrentUserState ? errorMessage : null;

  const value = useMemo(
    () => ({
      errorMessage: exposedErrorMessage,
      markProfileCreated,
      profile: exposedProfile,
      refreshProfile,
      status: exposedStatus,
    }),
    [
      exposedErrorMessage,
      exposedProfile,
      exposedStatus,
      markProfileCreated,
      refreshProfile,
    ]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}
