'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, Pill, ProgressBar, SubText } from '@/components';
import { fmt, fmtNum } from './ui';
import { computePlannedExpenses, type PlannedExpensesTotals } from './finances.utils';
import type { CategoriesResponse } from '@/app/api/finances/categories/route';

type AvailableCardProps = {
  availableBalance: number;
  currency: string;
  month: string;
};

/**
 * Dashboard "Available" card. Fetches the same category rows the Categories page's "Planned
 * Expenses" card/sheet use and runs them through the shared `computePlannedExpenses` aggregation,
 * so the spent-toward-plan bar and spare/short badge here never drift from that screen's numbers.
 */
export function AvailableCard({ availableBalance, currency, month }: AvailableCardProps) {
  const [planned, setPlanned] = useState<PlannedExpensesTotals | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<CategoriesResponse>('/api/finances/categories', {
        query: { month },
        silentToast: true,
      });
      setPlanned(computePlannedExpenses(result.allCategories));
    } catch {
      setPlanned(null);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPlanned = planned?.totalPlanned ?? 0;
  const spentTowardPlan = planned?.spentTowardPlan ?? 0;
  const spare = availableBalance - (totalPlanned - spentTowardPlan);

  return (
    <Card className="p-[14px]">
      <SubText className="block mb-1.5 uppercase tracking-[0.08em]">Available</SubText>
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">
        {fmt(availableBalance, currency)}
      </div>

      {totalPlanned > 0 && (
        <div className="mt-2.5">
          <ProgressBar value={spentTowardPlan} max={totalPlanned} color="var(--blue)" thresholds={false} height={5} />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--muted)] tabular-nums">
              {fmtNum(spentTowardPlan)} / {fmtNum(totalPlanned)} {currency} max plan
            </span>
            <Pill
              label={spare >= 0 ? `+${fmtNum(spare)} spare` : `-${fmtNum(Math.abs(spare))} short`}
              color={spare >= 0 ? 'var(--green)' : 'var(--red)'}
              className="shrink-0"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
