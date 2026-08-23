import type { Session } from '@supabase/supabase-js';
import { createContext } from 'react';

export type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);
