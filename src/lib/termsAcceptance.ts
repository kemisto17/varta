import Storage from 'expo-sqlite/kv-store';
import { TERMS_VERSION } from '../constants/policies';

const TERMS_ACCEPTANCE_KEY_PREFIX = 'varta:terms-acceptance:';

function getTermsAcceptanceKey(userId: string) {
  return `${TERMS_ACCEPTANCE_KEY_PREFIX}${userId}`;
}

export function hasCachedCurrentTermsAcceptance(userId: string) {
  try {
    return Storage.getItemSync(getTermsAcceptanceKey(userId)) === TERMS_VERSION;
  } catch {
    return false;
  }
}

export function cacheCurrentTermsAcceptance(userId: string) {
  try {
    Storage.setItemSync(getTermsAcceptanceKey(userId), TERMS_VERSION);
  } catch {
    // Supabase remains authoritative if local storage is unavailable.
  }
}

export function clearCachedTermsAcceptance(userId: string) {
  try {
    Storage.removeItemSync(getTermsAcceptanceKey(userId));
  } catch {
    // A later server check will retry invalidating the local cache.
  }
}
