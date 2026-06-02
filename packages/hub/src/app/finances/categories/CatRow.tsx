'use client';

import { cn } from '@/lib/utils';
import { ProgressBar, SubText, SwipeRow } from '@/components';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { fmt, CategoryIcon } from '../ui';
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
  const pct = cat.monthlyTarget && cat.monthlyTarget > 0 ? Math.round((cat.spent / cat.monthlyTarget) * 100) : null;
  const barColor =
    pct === null
      ? 'var(--muted)'
      : pct >= 100
        ? 'var(--red)'
        : pct >= 80
          ? 'var(--amber)'
          : (cat.color ?? 'var(--green)');

  return (
    <div className={cn('px-[14px] py-[10px]', onClick && 'cursor-pointer')} onClick={onClick}>
      <div className={cn('flex items-center gap-2.5', pct !== null ? 'mb-2' : 'mb-0')}>
        <CategoryIcon color={cat.color} icon={cat.icon} size="lg" fallback={cat.name[0]?.toUpperCase() ?? '?'} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--text)]">{cat.name}</div>
          {cat.monthlyTarget ? <SubText className="block">Target {fmt(cat.monthlyTarget, currency)}/mo</SubText> : null}
        </div>
        <div className="text-right">
          <div
            className={cn(
              'text-sm font-semibold',
              pct !== null && pct >= 100 ? 'text-[var(--red)]' : 'text-[var(--text)]',
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
        <ProgressBar value={cat.spent} max={cat.monthlyTarget!} color={cat.color ?? 'var(--green)'} height={4} />
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
          <div className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-1 shadow-sm">
            <button
              aria-label={`Edit category ${cat.name}`}
              onClick={e => {
                e.stopPropagation();
                onEdit(cat);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--card2)] hover:text-[var(--text)]"
            >
              <PencilIcon className="size-3" /> Edit
            </button>
            <span className="h-3 w-px bg-[var(--border)]" />
            <button
              aria-label={`Delete category ${cat.name}`}
              onClick={e => {
                e.stopPropagation();
                onDelete(cat);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--red)]/10 hover:text-[var(--red)]"
            >
              <TrashIcon className="size-3" /> Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
