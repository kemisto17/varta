import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  StudentVerification,
  VerificationStatus,
} from '../contexts/VerificationContext';
import { VerificationContext } from '../contexts/VerificationContext';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  getStudentVerification,
  getVerificationStatus,
} from '../lib/verification';

export function VerificationProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { status: profileStatus } = useProfile();
  const userId = session?.user.id ?? null;
  const requestId = useRef(0);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [verification, setVerification] =
    useState<StudentVerification | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const activeRequestId = requestId.current + 1;
    requestId.current = activeRequestId;

    if (!userId || profileStatus !== 'ready') {
      setVerification(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    const loadVerification = async () => {
      try {
        const nextVerification = await getStudentVerification(userId);

        if (requestId.current !== activeRequestId) {
          return;
        }

        setVerification(nextVerification);
        setStatus(getVerificationStatus(nextVerification));
      } catch {
        if (requestId.current !== activeRequestId) {
          return;
        }

        setVerification(null);
        setStatus('error');
        setErrorMessage(
          'We could not check your verification status. Check your connection and try again.'
        );
      }
    };

    void loadVerification();
  }, [profileStatus, refreshIndex, userId]);

  const refreshVerification = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  const markVerificationSubmitted = useCallback(
    (nextVerification: StudentVerification) => {
      requestId.current += 1;
      setVerification(nextVerification);
      setStatus(getVerificationStatus(nextVerification));
      setErrorMessage(null);
    },
    []
  );

  const markVerificationDeleted = useCallback(() => {
    requestId.current += 1;
    setVerification(null);
    setStatus('missing');
    setErrorMessage(null);
  }, []);

  const value = useMemo(
    () => ({
      errorMessage,
      markVerificationDeleted,
      markVerificationSubmitted,
      refreshVerification,
      status,
      verification,
    }),
    [
      errorMessage,
      markVerificationDeleted,
      markVerificationSubmitted,
      refreshVerification,
      status,
      verification,
    ]
  );

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
}
