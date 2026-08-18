'use client';

import { cn } from '@/lib/utils';
import { ClocheIcon, CheckOutlineIcon, XOutlineIcon } from '@/components/icons';
import type { MenuDayStatus } from './calendar.utils';

type MenuStatusBadgeProps = {
  status: MenuDayStatus;
};

/**
 * Corner badge on a calendar day cell for that day's weekly-menu plan: a covered-dish icon alone
 * while the day still has time to be logged (`planned` or `pending`), a green check once every
 * planned meal is logged, and a red x once the day has passed with something unlogged. Renders
 * nothing when no menu is planned.
 */
export function MenuStatusBadge({ status }: MenuStatusBadgeProps) {
  if (status === 'none') return null;

  return (
    <span className="absolute top-0.5 right-0.5 text-[var(--subtle)]">
      <ClocheIcon className="size-3" />
      {(status === 'logged' || status === 'missed') && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full',
            status === 'logged' ? 'bg-[var(--green)]' : 'bg-[var(--red)]',
          )}
        >
          {status === 'logged' ? (
            <CheckOutlineIcon className="size-1.5 text-[var(--card)]" />
          ) : (
            <XOutlineIcon className="size-1.5 text-[var(--card)]" />
          )}
        </span>
      )}
    </span>
  );
}
