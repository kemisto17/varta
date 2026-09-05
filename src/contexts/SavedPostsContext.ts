import { createContext } from 'react';

export type SavedPostsContextValue = {
  isReady: boolean;
  pendingPostIds: Set<string>;
  refreshSavedPosts: () => Promise<void>;
  savedPostIds: Set<string>;
  toggleSavedPost: (postId: string) => Promise<boolean>;
};

export const SavedPostsContext = createContext<SavedPostsContextValue | undefined>(
  undefined
);
