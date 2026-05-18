'use client';

import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { Input } from '@/components';
import { FinModalShell } from '../FinModalShell';
import { FinFieldCard, SectionLabel, renderAccountOption, renderCategoryOption } from '../ui';
import { FinancialDropdown } from '../FinancialDropdown';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import type { SupportedCurrency } from '@my-hub/shared/constants';
import {
  EditPlanItemSchema,
  planItemToEditValues,
  formToEditPlanItem,
  type EditPlanItemValues,
} from '../finances-form.schema';
import type { MonthlyPlanItem } from '@/app/api/finances/monthly-plans/[month]/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import { fmtNum } from './monthly-plan.utils';

type PlanItemModalProps = {
  defaultCurrency: SupportedCurrency;
  formData: TransactionFormDataResponse | null;
  onClose: () => void;
  item?: MonthlyPlanItem;
  onSave: (patch: ReturnType<typeof formToEditPlanItem>) => Promise<void>;
};

const dropdownInputClass = 'py-0 text-[13px] font-medium text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]';
const ghostInputClass = 'w-full text-[13px] text-[var(--fin-text)]';

export function PlanItemModal({ defaultCurrency, formData, onClose, item, onSave }: PlanItemModalProps) {
  const isEdit = item != null;

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EditPlanItemValues>({
    resolver: zodResolver(EditPlanItemSchema),
    mode: 'onChange',
    defaultValues: isEdit
      ? planItemToEditValues(item, defaultCurrency)
      : { name: '', amount: '', currency: defaultCurrency, linkedAccountId: '', categoryId: '', assignedAmount: '0' },
  });

  const assignedAmount = watch('assignedAmount');
  const itemCurrency = watch('currency');
  const delta = isEdit ? (parseFloat(assignedAmount) || 0) - item.assignedAmount : 0;
  const submitHandler = handleSubmit(values => onSave(formToEditPlanItem(values)));

  const accountOptions = useMemo(
    () => (formData?.accounts ?? []).map(a => ({ id: String(a.id), value: a.name })),
    [formData?.accounts],
  );
  const categoryOptions = useMemo(
    () => (formData?.categories ?? []).map(c => ({ id: String(c.id), value: c.name })),
    [formData?.categories],
  );

  return (
    <FinModalShell
      onClose={onClose}
      title={isEdit ? 'Edit Item' : 'Add Plan Item'}
      className="md:max-w-[420px]"
      onSubmit={submitHandler}
      submitLabel={isEdit ? 'Save Changes' : 'Add Item'}
      submitLoading={isSubmitting}
    >
      <form onSubmit={submitHandler} className="flex flex-col gap-2">
        <FinFieldCard label="Name">
          <Input
            {...register('name')}
            aria-label="Name"
            placeholder={isEdit ? undefined : 'e.g. Rent'}
            autoFocus
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>

        <FinFieldCard label={isEdit ? 'Planned Amount' : 'Amount'}>
          <div className="flex items-center gap-2">
            <Input
              {...register('amount')}
              aria-label={isEdit ? 'Planned amount' : 'Amount'}
              type="number"
              step="0.01"
              placeholder="0"
              variant="ghost"
              className={`${ghostInputClass} text-right`}
            />
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <FinancialDropdown
                  searchable={false}
                  options={SupportedCurrencies.map(code => ({ id: code, value: code }))}
                  value={field.value}
                  onChange={opt => field.onChange((opt?.id as SupportedCurrency | undefined) ?? defaultCurrency)}
                  placeholder={defaultCurrency}
                  inputClassName={`${dropdownInputClass} text-center text-[11px]`}
                  menuClassName="min-w-[72px]"
                />
              )}
            />
          </div>
        </FinFieldCard>

        <FinFieldCard label="Account (optional)">
          <Controller
            control={control}
            name="linkedAccountId"
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={accountOptions}
                value={field.value || undefined}
                onChange={opt => field.onChange((opt?.id as string | undefined) ?? '')}
                placeholder="— None —"
                clearable
                renderOption={opt => renderAccountOption(opt, formData?.accounts ?? [])}
                inputClassName={dropdownInputClass}
              />
            )}
          />
        </FinFieldCard>

        <FinFieldCard label="Category (optional)">
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={categoryOptions}
                value={field.value || undefined}
                onChange={opt => field.onChange((opt?.id as string | undefined) ?? '')}
                placeholder="— None —"
                clearable
                renderOption={opt => renderCategoryOption(opt, formData?.categories ?? [])}
                inputClassName={dropdownInputClass}
              />
            )}
          />
        </FinFieldCard>

        {isEdit && (
          <div>
            <SectionLabel className="mt-1">Assigned Amount</SectionLabel>
            <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-3">
              <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--fin-muted)]">
                <span>Current</span>
                <span className="font-semibold tabular-nums text-[var(--fin-text)]">
                  {fmtNum(item.assignedAmount)} {itemCurrency}
                </span>
              </div>
              <Input
                {...register('assignedAmount')}
                type="number"
                step="0.01"
                min="0"
                variant="ghost"
                className="mb-2 w-full text-right text-[15px] font-semibold"
              />
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--fin-subtle)]">Difference</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    delta > 0
                      ? 'text-[var(--fin-green)]'
                      : delta < 0
                        ? 'text-[var(--fin-red)]'
                        : 'text-[var(--fin-muted)]',
                  )}
                >
                  {delta > 0 ? '+' : ''}
                  {fmtNum(delta)} {itemCurrency}
                </span>
              </div>
            </div>
          </div>
        )}
      </form>
    </FinModalShell>
  );
}
