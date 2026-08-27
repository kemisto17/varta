import type { PropsWithChildren } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

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

export function VerificationProvider({
  children,
}: PropsWithChildren) {
  const { session } = useAuth();

  const {
    status: profileStatus,
  } = useProfile();

  const userId =
    session?.user.id ?? null;

  const requestId =
    useRef(0);

  const resolvedUserId =
    useRef<string | null>(
      null
    );

  const statusRef =
    useRef<VerificationStatus>(
      'idle'
    );

  const [
    refreshIndex,
    setRefreshIndex,
  ] =
    useState(0);

  const [
    status,
    setStatus,
  ] =
    useState<VerificationStatus>(
      'idle'
    );

  const [
    stateUserId,
    setStateUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    verification,
    setVerification,
  ] =
    useState<StudentVerification | null>(
      null
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null
    );

  /*
   * Load the current verification
   * state.
   *
   * requestId prevents an older request
   * from overwriting state after:
   *
   * - sign out
   * - account switch
   * - manual refresh
   * - foreground refresh
   */
  useEffect(() => {
    const activeRequestId =
      requestId.current + 1;

    requestId.current =
      activeRequestId;

    if (
      !userId ||
      profileStatus !== 'ready'
    ) {
      resolvedUserId.current =
        null;

      setStateUserId(
        null
      );

      statusRef.current =
        'idle';

      setVerification(
        null
      );

      setStatus(
        'idle'
      );

      setErrorMessage(
        null
      );

      return;
    }

    const isBackgroundRefresh =
      resolvedUserId.current ===
        userId &&
      statusRef.current !==
        'idle' &&
      statusRef.current !==
        'loading' &&
      statusRef.current !==
        'error';

    /*
     * Preserve the existing onboarding
     * screen during background refreshes.
     *
     * This prevents a full-screen loading
     * flash whenever the app returns from
     * the background.
     */
    if (!isBackgroundRefresh) {
      statusRef.current =
        'loading';

      setStatus(
        'loading'
      );
    }

    setErrorMessage(
      null
    );

    const loadVerification =
      async () => {
        try {
          const nextVerification =
            await getStudentVerification(
              userId
            );

          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          const nextStatus =
            getVerificationStatus(
              nextVerification
            );

          resolvedUserId.current =
            userId;

          setStateUserId(
            userId
          );

          statusRef.current =
            nextStatus;

          setVerification(
            nextVerification
          );

          setStatus(
            nextStatus
          );
        } catch {
          if (
            requestId.current !==
            activeRequestId
          ) {
            return;
          }

          /*
           * Initial load failures must
           * block navigation because we
           * do not know the user's access
           * state.
           *
           * Background refresh failures
           * keep the last known state so
           * a temporary network problem
           * does not throw the user out of
           * their current screen.
           */
          if (!isBackgroundRefresh) {
            resolvedUserId.current =
              userId;

            setStateUserId(
              userId
            );

            statusRef.current =
              'error';

            setVerification(
              null
            );

            setStatus(
              'error'
            );
          }

          setErrorMessage(
            'We could not check your verification status. Check your connection and try again.'
          );
        }
      };

    void loadVerification();
  }, [
    profileStatus,
    refreshIndex,
    userId,
  ]);

  /*
   * Verification may be approved or
   * rejected while the app is in the
   * background.
   *
   * Refresh automatically when the user
   * returns to Varta so a warm app resume
   * behaves the same as reopening the app
   * from scratch.
   *
   * We only need this while a submission
   * exists and can change externally.
   */
  useEffect(() => {
    if (
      !userId ||
      profileStatus !== 'ready'
    ) {
      return;
    }

    const subscription =
      AppState.addEventListener(
        'change',
        (nextState) => {
          if (
            nextState !== 'active'
          ) {
            return;
          }

          if (
            statusRef.current !==
              'pending' &&
            statusRef.current !==
              'rejected'
          ) {
            return;
          }

          setRefreshIndex(
            (current) =>
              current + 1
          );
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    profileStatus,
    userId,
  ]);

  const refreshVerification =
    useCallback(() => {
      setRefreshIndex(
        (current) =>
          current + 1
      );
    }, []);

  const markVerificationSubmitted =
    useCallback(
      (
        nextVerification:
          StudentVerification
      ) => {
        if (
          nextVerification.user_id !==
          userId
        ) {
          return;
        }

        requestId.current +=
          1;

        resolvedUserId.current =
          nextVerification.user_id;

        setStateUserId(
          nextVerification.user_id
        );

        statusRef.current =
          getVerificationStatus(
            nextVerification
          );

        setVerification(
          nextVerification
        );

        setStatus(
          statusRef.current
        );

        setErrorMessage(
          null
        );
      },
      [userId]
    );

  const markVerificationDeleted =
    useCallback(() => {
      requestId.current +=
        1;

      /*
       * Keep the resolved user identity.
       *
       * We know this user's verification
       * state is now definitively
       * "missing"; this also lets a later
       * refresh remain a background
       * refresh rather than flashing the
       * global loading screen.
       */
      resolvedUserId.current =
        userId;

      setStateUserId(
        userId
      );

      statusRef.current =
        'missing';

      setVerification(
        null
      );

      setStatus(
        'missing'
      );

      setErrorMessage(
        null
      );
    }, [userId]);

  const isCurrentUserState =
    stateUserId ===
    userId;

  const exposedStatus:
    VerificationStatus =
      !userId
        ? 'idle'
        : isCurrentUserState
          ? status
          : 'loading';

  const exposedVerification =
    isCurrentUserState
      ? verification
      : null;

  const exposedErrorMessage =
    isCurrentUserState
      ? errorMessage
      : null;

  const value =
    useMemo(
      () => ({
        errorMessage:
          exposedErrorMessage,
        markVerificationDeleted,
        markVerificationSubmitted,
        refreshVerification,
        status:
          exposedStatus,
        verification:
          exposedVerification,
      }),
      [
        exposedErrorMessage,
        exposedStatus,
        exposedVerification,
        markVerificationDeleted,
        markVerificationSubmitted,
        refreshVerification,
      ]
    );

  return (
    <VerificationContext.Provider
      value={value}
    >
      {children}
    </VerificationContext.Provider>
  );
}
