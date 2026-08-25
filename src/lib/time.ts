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

export function formatEventStart(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const time = new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (isSameLocalDay(date, now)) {
    return `Today · ${time}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameLocalDay(date, tomorrow)) {
    return `Tomorrow · ${time}`;
  }

  const dateLabel = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear()
      ? {}
      : { year: 'numeric' as const }),
  }).format(date);

  return `${dateLabel} · ${time}`;
}

export function formatEventDateRange(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    return '';
  }

  const startLabel = formatEventStart(startsAt);

  if (!endsAt) {
    return startLabel;
  }

  const end = new Date(endsAt);

  if (Number.isNaN(end.getTime())) {
    return startLabel;
  }

  if (isSameLocalDay(start, end)) {
    return `${startLabel} – ${new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(end)}`;
  }

  return `${startLabel} – ${new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(end)}`;
}

export function formatDateInput(date: Date) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTimeInput(date: Date) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function isEventHappeningNow(
  startsAt: string,
  endsAt: string | null,
  now = Date.now()
) {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : start + 2 * HOUR;

  return start <= now && end >= now;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
