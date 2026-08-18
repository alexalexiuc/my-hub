'use client';

import { cn } from '@/lib/utils';
import { ClocheIcon, ClockOutlineIcon, CheckOutlineIcon, XOutlineIcon } from '@/components/icons';
import type { MenuDayStatus } from './calendar.utils';

type MenuStatusIconProps = {
  status: MenuDayStatus;
  className?: string;
};

/**
 * Bottom-of-cell menu status indicator for the taller mobile calendar grid — bigger and more
 * legible than the desktop corner badge, since a taller cell has the room for it. `pending`
 * (today, unlogged) renders as an amber clock rather than the bare cloche `planned` uses for a
 * future day, so today reads as "still time to log" rather than blending into an ordinary
 * planned day. Renders nothing when no menu is planned.
 */
export function MenuStatusIcon({ status, className }: MenuStatusIconProps) {
  if (status === 'none') return null;

  if (status === 'logged') {
    return (
      <span className={cn('flex size-4 items-center justify-center rounded-full bg-[var(--green)]', className)}>
        <CheckOutlineIcon className="size-2.5 text-[var(--card)]" />
      </span>
    );
  }

  if (status === 'missed') {
    return (
      <span className={cn('flex size-4 items-center justify-center rounded-full bg-[var(--red)]', className)}>
        <XOutlineIcon className="size-2.5 text-[var(--card)]" />
      </span>
    );
  }

  if (status === 'pending') {
    return <ClockOutlineIcon className={cn('size-4 text-[var(--accent)]', className)} />;
  }

  return <ClocheIcon className={cn('size-4 text-[var(--subtle)]', className)} />;
}
