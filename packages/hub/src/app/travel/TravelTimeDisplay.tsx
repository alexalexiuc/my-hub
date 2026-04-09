'use client';

import { formatSegmentTime, getTimezoneBadge, getFullDateTooltip } from '@my-hub/shared/utils';

type TravelTimeDisplaySize = 'xs' | 'sm' | 'md';

type TravelTimeDisplayProps = {
  datetime: string;
  timezone: string | null;
  now?: Date;
  size?: TravelTimeDisplaySize;
  showTimezoneOffset?: boolean;
  className?: string;
  timeClassName?: string;
};

const sizeClasses: Record<TravelTimeDisplaySize, { time: string; meta: string }> = {
  xs: { time: 'text-xs', meta: 'text-[9px]' },
  sm: { time: 'text-sm', meta: 'text-[10px]' },
  md: { time: 'text-base', meta: 'text-xs' },
};

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
