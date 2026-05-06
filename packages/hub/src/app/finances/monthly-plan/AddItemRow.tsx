'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@/components';
import { FinancialDropdown } from '../FinancialDropdown';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import { AddPlanItemSchema, type AddPlanItemValues } from '../finances-form.schema';
import type { TransactionFormDataResponse } from '@/app/api/finances/contracts';

export type NewItemState = AddPlanItemValues;

type AddItemRowProps = {
  defaultCurrency: string;
  formData: TransactionFormDataResponse | null;
  onSave: (item: NewItemState) => Promise<void>;
  onCancel: () => void;
};

export function AddItemRow({ defaultCurrency, formData, onSave, onCancel }: AddItemRowProps) {
  const fallbackCurrency = SupportedCurrencies.includes(defaultCurrency as (typeof SupportedCurrencies)[number])
    ? defaultCurrency
    : SupportedCurrencies[0];

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting, isValid },
  } = useForm<NewItemState>({
    resolver: zodResolver(AddPlanItemSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      amount: '',
      currency: fallbackCurrency,
      linkedAccountId: '',
      categoryId: '',
    },
  });

  useEffect(() => {
    setValue('currency', fallbackCurrency);
  }, [fallbackCurrency, setValue]);

  const accountOptions = useMemo(
    () => (formData?.accounts ?? []).map(account => ({ id: String(account.id), value: account.name })),
    [formData?.accounts],
  );
  const categoryOptions = useMemo(
    () => (formData?.categories ?? []).map(category => ({ id: String(category.id), value: category.name })),
    [formData?.categories],
  );

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      className="border-t border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-3 md:px-4"
    >
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_8rem_8rem_10rem_5rem] md:items-center md:gap-3">
        <Input
          {...register('name')}
          autoFocus
          placeholder="Item name"
          className="rounded border border-[var(--fin-border)] bg-[var(--fin-card3)] px-2 py-1.5 text-[13px] text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]"
        />

        <Input
          {...register('amount')}
          type="number"
          step="0.01"
          placeholder="0"
          className="rounded border border-[var(--fin-border)] bg-[var(--fin-card3)] px-2 py-1.5 text-right text-[13px] text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]"
        />

        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <FinancialDropdown
              searchable={false}
              options={SupportedCurrencies.map(currency => ({ id: currency, value: currency }))}
              value={field.value}
              onChange={item => field.onChange((item?.id as string) ?? fallbackCurrency)}
              placeholder="Currency"
              inputClassName="rounded border border-[var(--fin-border)] bg-[var(--fin-card3)] px-2 py-1.5 text-center text-[11px] text-[var(--fin-muted)]"
            />
          )}
        />

        <div className="grid grid-cols-1 gap-1 md:gap-1.5">
          <Controller
            control={control}
            name="linkedAccountId"
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={accountOptions}
                value={field.value || undefined}
                onChange={item => field.onChange((item?.id as string | undefined) ?? '')}
                placeholder="Account…"
                clearable
                inputClassName="rounded border border-[var(--fin-border)] bg-[var(--fin-card3)] px-2 py-1 text-[11px] text-[var(--fin-muted)]"
              />
            )}
          />

          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={categoryOptions}
                value={field.value || undefined}
                onChange={item => field.onChange((item?.id as string | undefined) ?? '')}
                placeholder="Category…"
                clearable
                inputClassName="rounded border border-[var(--fin-border)] bg-[var(--fin-card3)] px-2 py-1 text-[11px] text-[var(--fin-muted)]"
              />
            )}
          />
        </div>

        <div className="flex items-center gap-2 md:flex-col md:gap-1">
          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            loading={isSubmitting}
            size="xs"
            className="flex-1 bg-[var(--fin-accent)] hover:bg-[var(--fin-accent)] md:w-full md:flex-none"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={onCancel}
            className="flex-1 border-[var(--fin-border)] text-[var(--fin-muted)] hover:bg-transparent hover:text-[var(--fin-text)] md:w-full md:flex-none"
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
