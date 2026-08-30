import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { AuthContext } from '../contexts/AuthContext';
import {
  clearPendingPasswordRecoverySession,
  hasPendingPasswordRecoverySession,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let authEventVersion = 0;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (hasPendingPasswordRecoverySession()) {
        if (isMounted) {
          setSession(null);
          setIsLoading(false);
        }

        return;
      }

      authEventVersion += 1;

      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    });

    const restoreSession = async () => {
      const restoreVersion = authEventVersion;
      const {
        data: { session: storedSession },
        error,
      } = await supabase.auth.getSession();

      if (hasPendingPasswordRecoverySession()) {
        let recoverySessionWasCleared = false;

        try {
          const { error: signOutError } = await supabase.auth.signOut({
            scope: 'local',
          });

          recoverySessionWasCleared = !signOutError;
        } catch {
          // Keep the recovery session out of app state even if cleanup fails.
        }

        if (recoverySessionWasCleared) {
          clearPendingPasswordRecoverySession();
        }

        if (!isMounted) {
          return;
        }

        setSession(null);
        setIsLoading(false);
        return;
      }

      if (!isMounted || authEventVersion !== restoreVersion) {
        return;
      }

      setSession(error ? null : storedSession);
      setIsLoading(false);
    };

    void restoreSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ isLoading, session }),
    [isLoading, session]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
