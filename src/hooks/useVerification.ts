import { useContext } from 'react';

import { VerificationContext } from '../contexts/VerificationContext';

export function useVerification() {
  const context = useContext(VerificationContext);

  if (!context) {
    throw new Error(
      'useVerification must be used inside VerificationProvider.'
    );
  }

  return context;
}
