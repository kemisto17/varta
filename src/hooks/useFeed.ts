import { useContext } from 'react';

import { FeedContext } from '../contexts/FeedContext';

export function useFeed() {
  const context = useContext(FeedContext);

  if (!context) {
    throw new Error('useFeed must be used inside FeedProvider.');
  }

  return context;
}
