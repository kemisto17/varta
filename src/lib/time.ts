const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTimestamp(
  timestamp: string,
  now = Date.now()
) {
  const date = new Date(timestamp);
  const elapsed = now - date.getTime();

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (elapsed < MINUTE) {
    return 'just now';
  }

  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m`;
  }

  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)}h`;
  }

  if (elapsed < 2 * DAY) {
    return 'Yesterday';
  }

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: 'numeric' as const }),
  };

  return new Intl.DateTimeFormat('en', options).format(date);
}
