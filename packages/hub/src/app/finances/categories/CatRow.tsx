'use client';

import { cn } from '@/lib/utils';
import { SwipeRow } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { fmt, Bar, CategoryIcon } from '../ui';
import type { CategoryRow } from '@/app/api/finances/categories/route';

type CatRowProps = {
  cat: CategoryRow;
  currency: string;
  isSwipeOpen: boolean;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onEdit: (cat: CategoryRow) => void;
  onDelete: (cat: CategoryRow) => void;
  onOpen?: (cat: CategoryRow) => void;
};

function CatRowContent({ cat, currency, onClick }: { cat: CategoryRow; currency: string; onClick?: () => void }) {
  const pct =
    cat.monthlyTarget && cat.monthlyTarget > 0
      ? Math.min(100, Math.round((cat.spent / cat.monthlyTarget) * 100))
      : null;
  const barColor =
    pct === null
      ? 'var(--fin-muted)'
      : pct >= 100
        ? 'var(--fin-red)'
        : pct >= 80
          ? 'var(--fin-amber)'
          : (cat.color ?? 'var(--fin-green)');

  return (
    <div className={cn('px-[14px] py-[10px]', onClick && 'cursor-pointer')} onClick={onClick}>
      <div className={cn('flex items-center gap-2.5', pct !== null ? 'mb-2' : 'mb-0')}>
        <CategoryIcon color={cat.color} icon={cat.icon} size="lg" fallback={cat.name[0]?.toUpperCase() ?? '?'} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--fin-text)]">{cat.name}</div>
          {cat.monthlyTarget ? (
            <div className="text-[10px] text-[var(--fin-subtle)]">Target {fmt(cat.monthlyTarget, currency)}/mo</div>
          ) : null}
        </div>
        <div className="text-right">
          <div
            className={cn(
              'text-sm font-semibold',
              pct !== null && pct >= 100 ? 'text-[var(--fin-red)]' : 'text-[var(--fin-text)]',
            )}
          >
            {fmt(cat.spent, currency)}
          </div>
          {pct !== null && (
            <div className="text-[10px]" style={{ color: barColor }}>
              {pct}%
            </div>
          )}
        </div>
      </div>
      {pct !== null && (
        <Bar value={cat.spent} max={cat.monthlyTarget!} color={cat.color ?? 'var(--fin-green)'} height={4} />
      )}
      {cat.transferAmount > 0 && (
        <div className="mt-1 text-[10px] text-[var(--fin-subtle)]">
          + {fmt(cat.transferAmount, currency)} repayments
        </div>
      )}
    </div>
  );
}

export function CatRow({
  cat,
  currency,
  isSwipeOpen,
  onSwipeOpen,
  onSwipeClose,
  onEdit,
  onDelete,
  onOpen,
}: CatRowProps) {
  return (
    <>
      {/* Mobile: swipe to reveal */}
      <div data-layout="mobile" className="md:hidden">
        <SwipeRow
          isOpen={isSwipeOpen}
          onOpen={onSwipeOpen}
          onClose={onSwipeClose}
          onEdit={() => onEdit(cat)}
          onDelete={() => onDelete(cat)}
        >
          <CatRowContent cat={cat} currency={currency} onClick={onOpen ? () => onOpen(cat) : undefined} />
        </SwipeRow>
      </div>

      {/* Desktop: hover to reveal */}
      <div data-layout="desktop" className="group relative hidden md:block">
        <CatRowContent cat={cat} currency={currency} onClick={onOpen ? () => onOpen(cat) : undefined} />
        <div className="pointer-events-none absolute inset-y-0 right-[14px] flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-md border border-[var(--fin-border)] bg-[var(--fin-card)] px-1.5 py-1 shadow-sm">
            <button
              aria-label={`Edit category ${cat.name}`}
              onClick={e => {
                e.stopPropagation();
                onEdit(cat);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--fin-muted)] transition-colors hover:bg-[var(--fin-card2)] hover:text-[var(--fin-text)]"
            >
              <PencilIcon className="size-3" /> Edit
            </button>
            <span className="h-3 w-px bg-[var(--fin-border)]" />
            <button
              aria-label={`Delete category ${cat.name}`}
              onClick={e => {
                e.stopPropagation();
                onDelete(cat);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--fin-muted)] transition-colors hover:bg-[var(--fin-red)]/10 hover:text-[var(--fin-red)]"
            >
              <TrashIcon className="size-3" /> Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
