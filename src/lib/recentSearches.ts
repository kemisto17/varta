import Storage from 'expo-sqlite/kv-store';

import { MIN_SEARCH_CHARACTERS, normalizeSearchQuery } from './search';

const MAX_RECENT_SEARCHES = 6;
const STORAGE_PREFIX = 'varta.recent-searches';

export async function getRecentSearches(userId: string) {
  const storedValue = await Storage.getItem(getStorageKey(userId));

  if (!storedValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map(normalizeSearchQuery)
      .filter((value) => value.length >= MIN_SEARCH_CHARACTERS)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export async function addRecentSearch(userId: string, query: string) {
  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.length < MIN_SEARCH_CHARACTERS) {
    return getRecentSearches(userId);
  }

  const existing = await getRecentSearches(userId);
  const nextSearches = [
    normalizedQuery,
    ...existing.filter(
      (item) => item.toLocaleLowerCase() !== normalizedQuery.toLocaleLowerCase()
    ),
  ].slice(0, MAX_RECENT_SEARCHES);

  await Storage.setItem(getStorageKey(userId), JSON.stringify(nextSearches));

  return nextSearches;
}

export async function clearRecentSearches(userId: string) {
  await Storage.removeItem(getStorageKey(userId));
}

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}
