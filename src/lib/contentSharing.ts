import { Platform, Share } from 'react-native';

export type ShareableContentType = 'event' | 'post';

const SHARE_BASE_URL = 'https://kemisto17.github.io/varta/open/';

export function buildContentShareUrl(
  type: ShareableContentType,
  id: string
) {
  const query = new URLSearchParams({ id, type });
  return `${SHARE_BASE_URL}?${query.toString()}`;
}

export async function shareVartaContent(
  type: ShareableContentType,
  id: string
) {
  const noun = type === 'event' ? 'event' : 'post';
  const url = buildContentShareUrl(type, id);
  const message = `View this ${noun} on Varta.`;

  await Share.share(
    Platform.OS === 'ios'
      ? { message, url }
      : { message: `${message}\n${url}`, title: `Share ${noun}` },
    { dialogTitle: `Share ${noun}` }
  );
}
