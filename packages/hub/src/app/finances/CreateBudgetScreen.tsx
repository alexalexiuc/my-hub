'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { BudgetCreateResponse } from '@/app/api/finances/budgets/route';
import { Button, Card, Field, Input } from '@/components';
import { FinancialDropdown } from './FinancialDropdown';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import { SupportedCurrency } from '@my-hub/shared/constants';
import { CreateBudgetSchema, defaultCreateBudgetValues, type CreateBudgetValues } from './finances-form.schema';
import type { BudgetCreateBody } from '../api/finances/budgets/route';

type CreateBudgetScreenProps = {
  onCreated: () => void;
};

export function CreateBudgetScreen({ onCreated }: CreateBudgetScreenProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<CreateBudgetValues>({
    resolver: zodResolver(CreateBudgetSchema),
    defaultValues: defaultCreateBudgetValues,
  });

  const defaultCurrency = useWatch({ control, name: 'defaultCurrency' });

  async function onSubmit(values: CreateBudgetValues) {
    await apiFetch<BudgetCreateResponse, BudgetCreateBody>('/api/finances/budgets', {
      method: 'POST',
      body: { name: values.name.trim(), defaultCurrency: values.defaultCurrency },
      silentToast: true,
    });
    window.dispatchEvent(new CustomEvent('finances:budget-changed'));
    onCreated();
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card compact className="w-full max-w-[380px] p-7">
        <div className="mb-6 text-center">
          <div className="mb-2.5 text-[32px]">₤</div>
          <div className="mb-1.5 text-lg font-bold text-[var(--text)]">Create your budget</div>
          <div className="text-[13px] text-[var(--muted)]">
            Give your budget a name and pick a default currency to get started.
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[14px]">
          <Field label="Budget name">
            <Input {...register('name')} autoFocus placeholder="e.g. Household, Personal…" />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </Field>

          <Field label="Default currency">
            <FinancialDropdown
              searchable={false}
              options={SupportedCurrencies.map(c => ({ id: c, value: c }))}
              value={defaultCurrency}
              onChange={item => setValue('defaultCurrency', item?.id as SupportedCurrency)}
            />
          </Field>

          <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>
            Create budget
          </Button>
        </form>
      </Card>
    </div>
  );
}
