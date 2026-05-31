'use client';

import { cn } from '@/lib/utils';
import { Button, SwipeRow } from '@/components';
import { TrashOutlineIcon } from '@/components/icons';
import type { MonthlyPlanItem } from '@/app/api/finances/monthly-plans/[month]/route';
import { fmtNum } from './monthly-plan.utils';
import { SubText } from '../ui';

function LinkedToChip({ item }: { item: MonthlyPlanItem }) {
  if (!item.linkedAccountName && !item.categoryName) {
    return <span className="text-[12px] text-[var(--subtle)]">—</span>;
  }
  return (
    <div className="flex gap-1">
      {item.linkedAccountName && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--blue-d)] px-2.5 py-1 text-[11px] font-medium text-[var(--blue)]">
          → {item.linkedAccountName}
        </span>
      )}
      {item.categoryName && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--card3)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
          ← {item.categoryName}
        </span>
      )}
    </div>
  );
}

type PlanItemRowProps = {
  item: MonthlyPlanItem;
  currency: string;
  onToggle: (isAssigned: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function PlanItemRow({ item, currency, onToggle, onDelete, onEdit, isOpen, onOpen, onClose }: PlanItemRowProps) {
  const isDone = item.isAssigned || (item.assignedAmount >= item.amount && item.amount > 0);
  const isPartial = item.assignedAmount > 0 && !isDone;
  const progress = item.amount > 0 ? Math.min(100, (item.assignedAmount / item.amount) * 100) : 0;
  const isNonDefault = item.currency !== currency;

  return (
    <>
      {/* Desktop View */}
      <div
        data-layout="desktop"
        onClick={onEdit}
        className={cn(
          'group hidden md:grid cursor-pointer grid-cols-[1fr_8rem_8rem_15rem_3rem] items-center gap-3 border-b border-[var(--border)] px-4 py-3 transition-opacity hover:bg-[var(--card2)]',
          isDone && 'opacity-50',
        )}
      >
        <span className={cn('truncate text-[13px] font-medium text-[var(--text)]', isDone && 'line-through')}>
          {item.name}
        </span>

        <div className="text-right">
          {isNonDefault && <SubText className="mr-1">{item.currency}</SubText>}
          <span className="text-[13px] font-semibold tabular-nums text-[var(--text)]">{fmtNum(item.amount)}</span>
        </div>

        <div className="flex justify-end">
          {isDone ? (
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[14px] font-semibold tabular-nums text-[var(--green)]">
                {fmtNum(item.assignedAmount)}
              </span>
              <span className="text-[13px] text-[var(--green)]">✓</span>
            </div>
          ) : isPartial ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[13px] font-medium tabular-nums text-[var(--amber)]">
                {fmtNum(item.assignedAmount)}
              </span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--card3)]">
                <div
                  className="h-full rounded-full bg-[var(--amber)]"
                  style={{ width: `${progress}%`, transition: 'width .3s ease' }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[13px] text-[var(--subtle)]">—</span>
          )}
        </div>

        <LinkedToChip item={item} />

        <div className="flex items-center justify-end gap-1.5">
          <Button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            variant="transparent"
            title="Delete"
            className="hidden h-5 w-5 items-center justify-center p-0 text-[var(--subtle)] group-hover:flex hover:bg-transparent hover:text-[var(--red)]"
          >
            <TrashOutlineIcon className="size-3.5" />
          </Button>
          <Button
            onClick={e => {
              e.stopPropagation();
              onToggle(!isDone);
            }}
            title={isDone ? 'Mark as not done' : 'Mark as done'}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border p-0',
              isDone
                ? 'border-[var(--green)] bg-[var(--green)] text-white hover:bg-[var(--green)]'
                : 'border-[var(--border)] bg-transparent text-[var(--subtle)] hover:border-[var(--green)] hover:bg-transparent hover:text-[var(--green)]',
            )}
          >
            <span className="text-[11px] leading-none">✓</span>
          </Button>
        </div>
      </div>

      {/* Mobile View */}
      <div data-layout="mobile" className="border-b border-[var(--border)] md:hidden">
        <SwipeRow
          isOpen={isOpen}
          onOpen={onOpen}
          onClose={onClose}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={() => onToggle(!isDone)}
          completeDone={isDone}
        >
          <div className={cn('flex items-center gap-3 px-4 py-2 transition-opacity', isDone && 'opacity-50')}>
            <div className="min-w-0 flex-1">
              <span
                className={cn('block truncate text-[13px] font-medium text-[var(--text)]', isDone && 'line-through')}
              >
                {item.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="w-16 text-right text-[13px] font-semibold tabular-nums text-[var(--text)]">
                {isNonDefault && <SubText className="mr-0.5">{item.currency}</SubText>}
                {fmtNum(item.amount)}
              </div>
              <div
                className={cn(
                  'w-16 text-right text-[13px] font-semibold tabular-nums',
                  isDone ? 'text-[var(--green)]' : isPartial ? 'text-[var(--amber)]' : 'text-[var(--subtle)]',
                )}
              >
                {item.assignedAmount > 0 ? fmtNum(item.assignedAmount) : '—'}
              </div>
              <span className={cn('text-[var(--green)]', !isDone && 'invisible')}>✓</span>
            </div>
          </div>
        </SwipeRow>
      </div>
    </>
  );
}
