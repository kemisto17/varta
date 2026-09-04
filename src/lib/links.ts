import { supabase } from './supabase';

export const MAX_STRUCTURED_LINKS = 5;

export type StructuredLink = {
  id: string;
  label: string;
  position: number;
  url: string;
};

export type StructuredLinkDraft = Pick<StructuredLink, 'label' | 'url'>;

export type LinkifiedSegment = {
  mentionUsername: string | null;
  text: string;
  url: string | null;
};

const BANNED_SCHEME = /^(?:data|file|intent|javascript|vbscript):/i;

const LEADING_PUNCTUATION = /^[([{<"'“‘]+/;

const TRAILING_PUNCTUATION = /[\])}>"'”’.,!?;:]+$/;

const WEB_ADDRESS =
  /^(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{2,5})?(?:[/?#][^\s]*)?$/i;

export function getLinkifiedSegments(text: string): LinkifiedSegment[] {
  const segments: LinkifiedSegment[] = [];

  // Supports Markdown links:
  // [GitHub](https://github.com/kemisto17)
  // [https://github.com/kemisto17](https://github.com/kemisto17)
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = markdownLinkPattern.exec(text)) !== null) {
    // Process normal text before the Markdown link
    if (match.index > cursor) {
      segments.push(
        ...getPlainLinkifiedSegments(text.slice(cursor, match.index))
      );
    }

    const label = match[1];
    const rawUrl = match[2];
    const url = normalizeExternalUrl(rawUrl);

    if (url) {
      segments.push({
        mentionUsername: null,
        text: label,
        url,
      });
    } else {
      // Invalid Markdown URL — render normally
      segments.push({
        mentionUsername: null,
        text: match[0],
        url: null,
      });
    }

    cursor = match.index + match[0].length;
  }

  // Process remaining normal text
  if (cursor < text.length) {
    segments.push(...getPlainLinkifiedSegments(text.slice(cursor)));
  }

  return segments;
}

function getPlainLinkifiedSegments(text: string): LinkifiedSegment[] {
  const segments: LinkifiedSegment[] = [];
  const tokenPattern = /\S+/g;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({
        mentionUsername: null,
        text: text.slice(cursor, match.index),
        url: null,
      });
    }

    const token = match[0];

    const leading = token.match(LEADING_PUNCTUATION)?.[0] ?? '';
    const withoutLeading = token.slice(leading.length);

    const trailing =
      withoutLeading.match(TRAILING_PUNCTUATION)?.[0] ?? '';

    const candidate = withoutLeading.slice(
      0,
      withoutLeading.length - trailing.length
    );

    const url = normalizeExternalUrl(candidate);
    const mentionUsername = getMentionUsername(candidate);

    if (!url && !mentionUsername) {
      segments.push({
        mentionUsername: null,
        text: token,
        url: null,
      });
    } else {
      if (leading) {
        segments.push({
          mentionUsername: null,
          text: leading,
          url: null,
        });
      }

      segments.push({
        mentionUsername,
        text: candidate,
        url,
      });

      if (trailing) {
        segments.push({
          mentionUsername: null,
          text: trailing,
          url: null,
        });
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    segments.push({
      mentionUsername: null,
      text: text.slice(cursor),
      url: null,
    });
  }

  return segments;
}

function getMentionUsername(value: string) {
  const match =
    value.match(/^@([a-z0-9._]{3,30})$/i);

  return match?.[1].toLowerCase() ?? null;
}

export function normalizeExternalUrl(value: string) {
  const candidate = value.trim();

  if (
    !candidate ||
    BANNED_SCHEME.test(candidate) ||
    !WEB_ADDRESS.test(candidate)
  ) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(withScheme);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeStructuredLinkUrl(value: string) {
  const normalized = normalizeExternalUrl(value);

  if (!normalized) {
    throw new Error('Enter a valid website link.');
  }

  const url = new URL(normalized);
  url.protocol = 'https:';

  return url.toString();
}

export async function getProfileLinks(profileId: string) {
  const { data, error } = await supabase
    .from('profile_links')
    .select('id, label, url, position')
    .eq('profile_id', profileId)
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return data satisfies StructuredLink[];
}

export async function getOrganizationLinks(organizationId: string) {
  const { data, error } = await supabase
    .from('organization_links')
    .select('id, label, url, position')
    .eq('organization_id', organizationId)
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return data satisfies StructuredLink[];
}

export async function replaceProfileLinks(
  profileId: string,
  drafts: StructuredLinkDraft[]
) {
  const links = normalizeLinkDrafts(drafts);

  if (links.length > 0) {
    const { error } = await supabase.from('profile_links').upsert(
      links.map((link, position) => ({
        label: link.label,
        position,
        profile_id: profileId,
        url: link.url,
      })),
      {
        onConflict: 'profile_id,position',
      }
    );

    if (error) {
      throw error;
    }
  }

  const deleteQuery = supabase
    .from('profile_links')
    .delete()
    .eq('profile_id', profileId);

  const { error: deleteError } =
    links.length === 0
      ? await deleteQuery
      : await deleteQuery.gte('position', links.length);

  if (deleteError) {
    throw deleteError;
  }
}

export async function replaceOrganizationLinks(
  organizationId: string,
  drafts: StructuredLinkDraft[]
) {
  const links = normalizeLinkDrafts(drafts);

  if (links.length > 0) {
    const { error } = await supabase.from('organization_links').upsert(
      links.map((link, position) => ({
        label: link.label,
        organization_id: organizationId,
        position,
        url: link.url,
      })),
      {
        onConflict: 'organization_id,position',
      }
    );

    if (error) {
      throw error;
    }
  }

  const deleteQuery = supabase
    .from('organization_links')
    .delete()
    .eq('organization_id', organizationId);

  const { error: deleteError } =
    links.length === 0
      ? await deleteQuery
      : await deleteQuery.gte('position', links.length);

  if (deleteError) {
    throw deleteError;
  }
}

function normalizeLinkDrafts(drafts: StructuredLinkDraft[]) {
  if (drafts.length > MAX_STRUCTURED_LINKS) {
    throw new Error(`Add up to ${MAX_STRUCTURED_LINKS} links.`);
  }

  return drafts.map((draft) => {
    const label = draft.label.trim();

    if (!label || label.length > 40) {
      throw new Error('Each link needs a label up to 40 characters.');
    }

    return {
      label,
      url: normalizeStructuredLinkUrl(draft.url),
    };
  });
}

export function getLinksErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.startsWith('Add up to') ||
      error.message.startsWith('Each link') ||
      error.message.startsWith('Enter a valid'))
  ) {
    return error.message;
  }

  return 'We could not save these links. Check your connection and try again.';
}
