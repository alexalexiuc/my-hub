'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { Button, Field, Input, Select } from '@/components';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import { Card, SectionLabel } from '../ui';
import { CreateBudgetSchema, defaultCreateBudgetValues, type CreateBudgetValues } from '../finances-form.schema';
import type { BudgetInfo } from '@/app/api/finances/budget/budget.schema';
import type { BudgetCreateResponse } from '@/app/api/finances/budgets/route';
import type { BudgetActivateBody, BudgetCreateBody, BudgetsListResponse } from '@/app/api/finances/budgets/route';

type BudgetsSectionProps = {
  onChanged: () => void;
};

export function BudgetsSection({ onChanged }: BudgetsSectionProps) {
  const [budgets, setBudgets] = useState<BudgetInfo[]>([]);
  const [activating, setActivating] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CreateBudgetValues>({
    resolver: zodResolver(CreateBudgetSchema),
    defaultValues: defaultCreateBudgetValues,
  });

  const load = useCallback(async () => {
    const result = await apiFetch<BudgetsListResponse>('/api/finances/budgets', { silentToast: true });
    setBudgets(result.budgets);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMakeActive(id: number) {
    setActivating(id);
    try {
      await apiFetch<undefined, BudgetActivateBody>('/api/finances/budgets', {
        method: 'PATCH',
        body: { activeBudgetId: id },
        silentToast: true,
      });
      void onChanged();
      void load();
      window.dispatchEvent(new CustomEvent('finances:budget-changed'));
    } finally {
      setActivating(null);
    }
  }

  async function onCreateSubmit(values: CreateBudgetValues) {
    await apiFetch<BudgetCreateResponse, BudgetCreateBody>('/api/finances/budgets', {
      method: 'POST',
      body: { name: values.name.trim(), defaultCurrency: values.defaultCurrency },
      silentToast: true,
    });
    window.dispatchEvent(new CustomEvent('finances:budget-changed'));
    reset(defaultCreateBudgetValues);
    setShowCreate(false);
    void load();
    void onChanged();
  }

  return (
    <Card className="p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Budgets</SectionLabel>
        {!showCreate && (
          <Button size="xs" variant="secondary" onClick={() => setShowCreate(true)}>
            + New budget
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {budgets.map(b => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-[8px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-4 py-3"
          >
            <div>
              <div className="text-[14px] font-medium text-[var(--fin-text)]">{b.name}</div>
              <div className="text-[11px] text-[var(--fin-subtle)]">
                {b.defaultCurrency} · {b.isOwner ? 'Owner' : 'Member'}
              </div>
            </div>
            {b.isActive ? (
              <span
                className="rounded-[20px] bg-[var(--fin-accent-d)] px-2 py-[2px] text-[10px] text-[var(--fin-accent)]"
                style={{ border: `1px solid var(--fin-accent)44` }}
              >
                Active
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => void handleMakeActive(b.id)}
                loading={activating === b.id}
                disabled={activating !== null}
              >
                Make active
              </Button>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <form
          onSubmit={handleSubmit(onCreateSubmit)}
          className="mt-4 flex flex-col gap-[14px] border-t border-[var(--fin-border)] pt-4"
        >
          <div className="text-[13px] font-medium text-[var(--fin-text)]">New budget</div>
          <Field label="Budget name">
            <Input {...register('name')} autoFocus placeholder="e.g. Household, Personal…" />
            {errors.name && <p className="mt-1 text-xs text-[var(--fin-red)]">{errors.name.message}</p>}
          </Field>
          <Field label="Default currency">
            <Select {...register('defaultCurrency')}>
              {SupportedCurrencies.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={isSubmitting}>
              Create budget
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                reset(defaultCreateBudgetValues);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
