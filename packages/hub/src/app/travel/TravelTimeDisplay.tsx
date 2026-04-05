'use client';

import { formatSegmentTime } from './coming-next-utils';

type TravelTimeDisplaySize = 'xs' | 'sm' | 'md';

interface TravelTimeDisplayProps {
  datetime: string;
  timezone: string | null;
  now?: Date;
  size?: TravelTimeDisplaySize;
  showTimezoneOffset?: boolean;
  className?: string;
  timeClassName?: string;
}

const sizeClasses: Record<TravelTimeDisplaySize, { time: string; meta: string }> = {
  xs: { time: 'text-xs', meta: 'text-[9px]' },
  sm: { time: 'text-sm', meta: 'text-[10px]' },
  md: { time: 'text-base', meta: 'text-xs' },
};

function getTimezoneNamePart(date: Date, timezone: string, timeZoneName: 'short' | 'shortOffset' | 'long'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
      timeZoneName,
    }).formatToParts(date);

    const part = parts.find((item) => item.type === 'timeZoneName')?.value;
    return part ?? '';
  } catch {
    return '';
  }
}

function normalizeOffset(offsetLabel: string): string | null {
  const cleaned = offsetLabel.trim().replace(/^GMT/i, '').replace(/^UTC/i, '');
  if (!cleaned) return '+00:00';
  const match = cleaned.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const [, sign = '+', hours = '0', minutes = '00'] = match;
  const hh = hours.padStart(2, '0');
  const mm = minutes.padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function getTimezoneBadge(date: Date, timezone: string | null): { short: string; offset: string | null } {
  if (timezone === null) {
    return { short: 'UTC', offset: '+00:00' };
  }

  const shortName = getTimezoneNamePart(date, timezone, 'short');
  const offsetRaw = getTimezoneNamePart(date, timezone, 'shortOffset');
  const offset = normalizeOffset(offsetRaw);

  return {
    short: shortName || timezone,
    offset,
  };
}

function getFullDateTooltip(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
      timeZoneName: 'long',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function TravelTimeDisplay({
  datetime,
  timezone,
  now = new Date(),
  size = 'xs',
  showTimezoneOffset = false,
  className = '',
  timeClassName = '',
}: TravelTimeDisplayProps) {
  const date = new Date(datetime);
  const effectiveTimezone = timezone ?? 'UTC';
  const { text } = formatSegmentTime(datetime, timezone, now);
  const badge = getTimezoneBadge(date, timezone);
  const showUtcHighlight = timezone === null;
  const title = getFullDateTooltip(date, effectiveTimezone);

  return (
    <time dateTime={date.toISOString()} title={title} className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`${sizeClasses[size].time} ${timeClassName}`}>{text}</span>
      <span
        className={`rounded px-1 py-0.5 leading-none font-medium ${sizeClasses[size].meta} ${
          showUtcHighlight ? 'bg-sky-900 text-sky-300' : 'bg-zinc-700 text-zinc-400'
        }`}
      >
        {badge.short}
        {showTimezoneOffset && badge.offset ? ` ${badge.offset}` : ''}
      </span>
    </time>
  );
}
