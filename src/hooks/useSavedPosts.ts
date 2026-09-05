import { useContext } from 'react';

import { SavedPostsContext } from '../contexts/SavedPostsContext';

export function useSavedPosts() {
  const context = useContext(SavedPostsContext);

  if (!context) {
    throw new Error('useSavedPosts must be used within SavedPostsProvider.');
  }

  return context;
}
