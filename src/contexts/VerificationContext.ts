import { createContext } from 'react';

import type { Tables } from '../types/database';

export type StudentVerification = Tables<'student_verifications'>;

export type VerificationStatus =
  | 'idle'
  | 'loading'
  | 'missing'
  | 'pending'
  | 'rejected'
  | 'verified'
  | 'error';

export type VerificationContextValue = {
  errorMessage: string | null;
  markVerificationDeleted: () => void;
  markVerificationSubmitted: (verification: StudentVerification) => void;
  refreshVerification: () => void;
  status: VerificationStatus;
  verification: StudentVerification | null;
};

export const VerificationContext = createContext<
  VerificationContextValue | undefined
>(undefined);
