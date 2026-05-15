'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Field, Input } from '@/components';
import { FinancialDropdown } from '../FinancialDropdown';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import {
  EditPlanItemSchema,
  planItemToEditValues,
  formToEditPlanItem,
  type EditPlanItemValues,
} from '../finances-form.schema';
import type { MonthlyPlanItem } from '@/app/api/finances/monthly-plans/[month]/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import { SectionLabel } from '../ui';
import { fmtNum } from './monthly-plan.utils';

type EditPlanItemModalProps = {
  item: MonthlyPlanItem;
  currency: string;
  formData: TransactionFormDataResponse | null;
  onClose: () => void;
  onSave: (patch: ReturnType<typeof formToEditPlanItem>) => Promise<void>;
};

export function EditPlanItemModal({ item, currency, formData, onClose, onSave }: EditPlanItemModalProps) {
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EditPlanItemValues>({
    resolver: zodResolver(EditPlanItemSchema),
    defaultValues: planItemToEditValues(item, currency),
  });

  const assignedAmount = watch('assignedAmount');
  const itemCurrency = watch('currency');
  const parsedAssigned = parseFloat(assignedAmount) || 0;
  const delta = parsedAssigned - item.assignedAmount;

  return (
    <FinModalShell
      onClose={onClose}
      title="Edit Item"
      className="md:max-w-[420px]"
      onSubmit={handleSubmit(values => onSave(formToEditPlanItem(values)))}
      submitLabel="Save Changes"
      submitLoading={isSubmitting}
    >
      <form onSubmit={handleSubmit(values => onSave(formToEditPlanItem(values)))} className="flex flex-col gap-3">
        <Field label="Name">
          <Input {...register('name')} autoFocus />
        </Field>

        <div className="flex gap-2">
          <div className="flex-[3]">
            <Field label="Planned amount">
              <Input {...register('amount')} type="number" step="0.01" className="text-right" />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Currency">
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <FinancialDropdown
                    searchable={false}
                    options={SupportedCurrencies.map(code => ({ id: code, value: code }))}
                    value={field.value}
                    onChange={opt => field.onChange((opt?.id as string | undefined) ?? currency)}
                    placeholder={currency}
                  />
                )}
              />
            </Field>
          </div>
        </div>

        <div>
          <SectionLabel>Linked to</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <Controller
              control={control}
              name="linkedAccountId"
              render={({ field }) => (
                <FinancialDropdown
                  options={formData?.accounts.map(a => ({ id: String(a.id), value: a.name })) ?? []}
                  value={field.value || undefined}
                  onChange={opt => field.onChange((opt?.id as string | undefined) ?? '')}
                  placeholder="Account…"
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <FinancialDropdown
                  options={formData?.categories.map(c => ({ id: String(c.id), value: c.name })) ?? []}
                  value={field.value || undefined}
                  onChange={opt => field.onChange((opt?.id as string | undefined) ?? '')}
                  placeholder="Category…"
                  clearable
                />
              )}
            />
          </div>
        </div>

        <div>
          <SectionLabel>Assigned amount</SectionLabel>
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
      </form>
    </FinModalShell>
  );
}
