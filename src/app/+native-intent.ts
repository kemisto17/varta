import { isUuid } from '../lib/identifiers';

const SHARE_HOST = 'kemisto17.github.io';
const SHARE_PATH = '/varta/open';

export function redirectSystemPath({ path }: { initial: boolean; path: string }) {
  try {
    const url = new URL(path, 'varta://app');
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    const isWebShareLink =
      url.hostname === SHARE_HOST && normalizedPath === SHARE_PATH;
    const isRelativeWebShareLink =
      url.hostname === 'app' && normalizedPath === SHARE_PATH;
    const isCustomSchemeShareLink =
      url.protocol === 'varta:' && url.hostname === 'open';

    if (
      !isWebShareLink &&
      !isRelativeWebShareLink &&
      !isCustomSchemeShareLink
    ) {
      return path;
    }

    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type');

    if (!isUuid(id) || (type !== 'post' && type !== 'event')) {
      return '/';
    }

    return `/${type}/${id}`;
  } catch {
    return path;
  }
}
