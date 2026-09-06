'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PlusOutlineIcon } from '@/components/icons';

export type BottomNavItem = {
  id: string;
  icon: string;
  label: string;
  path: string;
  /** Use exact pathname match instead of startsWith — needed for root routes */
  exact?: boolean;
};

export type BottomNavFab = {
  /** Icon rendered inside the FAB circle — defaults to PlusOutlineIcon */
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
};

export type BottomNavProps = {
  leftItems: BottomNavItem[];
  rightItems?: BottomNavItem[];
  /** Items shown in the "More" bottom sheet when there are too many to fit in the tab bar */
  moreItems?: BottomNavItem[];
  fab?: BottomNavFab;
  className?: string;
};

function MoreSheet({ items, onClose }: { items: BottomNavItem[]; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isActive = (item: BottomNavItem) => (item.exact ? pathname === item.path : pathname.startsWith(item.path));

  return (
    <div
      onClick={onClose}
      className={cn(
        'fixed inset-0 z-[1000] flex items-end transition-[background-color] duration-300',
        open ? 'bg-[var(--overlay)]' : 'bg-transparent',
      )}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={cn(
          'w-full rounded-t-[18px] border border-[var(--border)] bg-[var(--card)] p-4 pb-8 transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)]" />
        <span className="mb-3 block px-1 text-[11px] uppercase tracking-[0.08em] text-[var(--subtle)]">More</span>
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => {
            const active = isActive(item);
            return (
              <button
                key={item.id}
                onClick={() => {
                  router.push(item.path);
                  onClose();
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] font-medium',
                  active
                    ? 'border-[var(--accent)44] bg-[var(--accent-d)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card2)] text-[var(--text)]',
                )}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Fixed bottom tab bar: nav items either side of an optional FAB, plus an optional "More"
 * sheet for the destinations that don't fit.
 *
 * Every child is an equal `flex-1` cell — the nav items, the FAB and the "More" button alike —
 * so the FAB lands dead centre only when the bar holds an odd number of cells:
 *
 *     leftItems.length === rightItems.length + (moreItems.length ? 1 : 0)
 *
 * Break it and the FAB sits half a cell off centre. Note that moving a single destination into
 * `moreItems` does not change the count: the "More" button takes the cell it vacated, so
 * rebalancing means moving two.
 */
export function BottomNav({ leftItems, rightItems = [], moreItems = [], fab, className }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  const isActive = (item: BottomNavItem) => (item.exact ? pathname === item.path : pathname.startsWith(item.path));

  const moreIsActive = moreItems.some(item => pathname.startsWith(item.path));

  return (
    <>
      {showMore && moreItems.length > 0 && <MoreSheet items={moreItems} onClose={() => setShowMore(false)} />}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[900] flex border-t border-[var(--border)] bg-[var(--card)]',
          className,
        )}
      >
        {leftItems.map(item => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2"
            >
              <span className={cn('text-lg leading-none', active ? 'text-[var(--accent)]' : 'text-[var(--subtle)]')}>
                {item.icon}
              </span>
              <span
                className={cn('text-[9px]', active ? 'font-semibold text-[var(--accent)]' : 'text-[var(--subtle)]')}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {fab && (
          <button
            onClick={fab.onClick}
            className="flex flex-1 cursor-pointer flex-col items-center border-none bg-transparent pt-1"
          >
            <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_4px_12px_var(--accent-shadow)]">
              {fab.icon ?? <PlusOutlineIcon className="size-5" />}
            </div>
            <span className="mt-1 text-[9px] text-[var(--subtle)]">{fab.label}</span>
          </button>
        )}

        {rightItems.map(item => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2"
            >
              <span className={cn('text-lg leading-none', active ? 'text-[var(--accent)]' : 'text-[var(--subtle)]')}>
                {item.icon}
              </span>
              <span
                className={cn('text-[9px]', active ? 'font-semibold text-[var(--accent)]' : 'text-[var(--subtle)]')}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {moreItems.length > 0 && (
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2"
          >
            <span
              className={cn('text-lg leading-none', moreIsActive ? 'text-[var(--accent)]' : 'text-[var(--subtle)]')}
            >
              ···
            </span>
            <span
              className={cn('text-[9px]', moreIsActive ? 'font-semibold text-[var(--accent)]' : 'text-[var(--subtle)]')}
            >
              More
            </span>
          </button>
        )}
      </div>
    </>
  );
}
