import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { AuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    });

    const restoreSession = async () => {
      const {
        data: { session: storedSession },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
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
