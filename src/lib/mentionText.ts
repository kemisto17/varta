export type MentionSelection = { start: number; end: number };
export type ActiveMention = { start: number; end: number; query: string };

export function getActiveMention(text: string, selection: MentionSelection): ActiveMention | null {
  if (selection.start !== selection.end || selection.start > text.length) return null;
  const before = text.slice(0, selection.start);
  const match = before.match(/(?:^|[\s([{"'<])@([a-z0-9._]{0,30})$/i);
  if (!match) return null;
  const query = match[1];
  const start = selection.start - query.length - 1;
  const suffix = text.slice(selection.start).match(/^[a-z0-9._]*/i)?.[0] ?? '';
  return { start, end: selection.start + suffix.length, query: query.toLowerCase() };
}

export function insertMention(text: string, mention: ActiveMention, username: string, maxLength?: number) {
  const suffix = text.slice(mention.end);
  const separator = /^[\s\])}>"'.,!?;:]/.test(suffix) ? '' : ' ';
  const replacement = `@${username}${separator}`;
  const value = text.slice(0, mention.start) + replacement + suffix;
  if (maxLength !== undefined && value.length > maxLength) return null;
  const caret = mention.start + replacement.length;
  return { value, selection: { start: caret, end: caret } };
}
