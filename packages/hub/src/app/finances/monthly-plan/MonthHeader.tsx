'use client';

import { useState } from 'react';
import { cn, apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { SectionLabel, MonthCarousel } from '../ui';

type MonthHeaderProps = {
  month: string;
  nextMonthExists: boolean | undefined;
  allDone: boolean;
  itemCount: number;
  onNavigate: (m: string) => void;
  onRefresh: () => Promise<void>;
};

export function MonthHeader({ month, nextMonthExists, allDone, itemCount, onNavigate, onRefresh }: MonthHeaderProps) {
  const [copying, setCopying] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const handleCopyNext = async () => {
    setCopying(true);
    try {
      const res = await apiFetch<{ created: boolean; targetMonth: string }>(
        `/api/finances/monthly-plans/${month}/copy-next`,
        { method: 'POST' },
      );
      if (res?.created) onNavigate(res.targetMonth);
    } finally {
      setCopying(false);
    }
  };

  const handleBulkAssign = async () => {
    setBulkAssigning(true);
    try {
      await apiFetch(`/api/finances/monthly-plans/${month}/assign-all`, { method: 'POST' });
      await onRefresh();
    } finally {
      setBulkAssigning(false);
    }
  };

  const markAllDoneBtn = (className?: string) => (
    <Button
      size="sm"
      onClick={handleBulkAssign}
      disabled={bulkAssigning || itemCount === 0}
      loading={bulkAssigning}
      className={cn(
        className,
        allDone
          ? 'bg-[var(--fin-green)] text-white hover:bg-[var(--fin-green)]'
          : 'border border-[var(--fin-accent)] bg-[var(--fin-accent-d)] text-[var(--fin-accent)] hover:bg-[var(--fin-accent-d)]',
      )}
    >
      ✓ Mark All Done
    </Button>
  );

  const copyNextBtn = (className?: string) => (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCopyNext}
      disabled={copying}
      loading={copying}
      className={cn('border-[var(--fin-border)] bg-[var(--fin-card)] text-[var(--fin-muted)]', className)}
    >
      Copy to next month
    </Button>
  );

  return (
    <>
      {/* Desktop */}
      <div data-layout="desktop" className="mb-5 hidden items-center justify-between md:flex">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fin-subtle)]">
            Monthly Plan
          </div>
          <MonthCarousel month={month} onNavigate={onNavigate} />
        </div>
        <div className="flex items-center gap-2">
          {!nextMonthExists && copyNextBtn('hover:border-[var(--fin-accent)] hover:text-[var(--fin-accent)]')}
          {nextMonthExists && <div className="w-[132px]" aria-hidden="true" />}
          {markAllDoneBtn('flex items-center gap-1.5')}
        </div>
      </div>

      {/* Mobile */}
      <div data-layout="mobile" className="mb-4 md:hidden">
        <SectionLabel>Monthly Plan</SectionLabel>
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2.5">
          <MonthCarousel
            month={month}
            onNavigate={onNavigate}
            className="flex-1 justify-between"
            labelClassName="text-[32px] font-bold leading-none tracking-tight"
          />
        </div>
        <div className="flex items-center gap-2">
          {!nextMonthExists && copyNextBtn()}
          {markAllDoneBtn('ml-auto')}
        </div>
      </div>
    </>
  );
}
