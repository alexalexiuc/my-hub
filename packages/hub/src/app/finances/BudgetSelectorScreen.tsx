'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { Card, SubText } from './ui';
import type { AvailableBudget } from '@/app/api/finances/dashboard/route';
import type { BudgetActivateBody } from '../api/finances/budgets/route';

type BudgetSelectorScreenProps = {
  budgets: AvailableBudget[];
  onActivated: () => void;
  onCreateNew: () => void;
};

export function BudgetSelectorScreen({ budgets, onActivated, onCreateNew }: BudgetSelectorScreenProps) {
  const [activating, setActivating] = useState<number | null>(null);

  async function handleActivate(id: number) {
    setActivating(id);
    try {
      await apiFetch<undefined, BudgetActivateBody>('/api/finances/budgets', {
        method: 'PATCH',
        body: { activeBudgetId: id },
        silentToast: true,
      });
      onActivated();
    } finally {
      setActivating(null);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card compact className="w-full max-w-[440px] p-7">
        <div className="mb-6 text-center">
          <div className="mb-2.5 text-[32px]">₤</div>
          <div className="mb-1.5 text-lg font-bold text-[var(--fin-text)]">Select a budget</div>
          <div className="text-[13px] text-[var(--fin-muted)]">
            Choose which budget to make active, or create a new one.
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {budgets.map(b => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-[8px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-4 py-3"
            >
              <div>
                <div className="text-[14px] font-medium text-[var(--fin-text)]">{b.name}</div>
                <SubText className="block">
                  {b.defaultCurrency} · {b.isOwner ? 'Owner' : 'Member'}
                </SubText>
              </div>
              <Button
                size="sm"
                onClick={() => void handleActivate(b.id)}
                loading={activating === b.id}
                disabled={activating !== null}
              >
                Make active
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-[var(--fin-border)] pt-5 text-center">
          <button onClick={onCreateNew} className="cursor-pointer text-[13px] text-[var(--fin-accent)] hover:underline">
            + Create a new budget
          </button>
        </div>
      </Card>
    </div>
  );
}
