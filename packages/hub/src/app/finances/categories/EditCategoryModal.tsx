'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { CategoryMutationResponse } from '@/app/api/finances/categories/route';
import type { CategoryUpdateBody } from '@/app/api/finances/categories/[id]/route';
import { FinModalShell } from '../FinModalShell';
import { ColorPicker, Input, Textarea } from '@/components';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinFieldCard } from '../ui';
import { ICON_OPTIONS } from '../categoryIcons';
import { EditCategorySchema, formToCategoryBody, type EditCategoryValues } from '../finances-form.schema';

type GroupOption = { id: number; name: string };

type EditCategoryModalProps = {
  categoryId: number;
  initialValues: EditCategoryValues;
  groups: GroupOption[];
  onClose: () => void;
  onSaved: () => void;
};

const PRESET_COLORS = [
  '#6ee7b7',
  '#93c5fd',
  '#a78bfa',
  '#fcd34d',
  '#f87171',
  '#2dd4bf',
  '#fb923c',
  '#e879f9',
  '#34d399',
  '#60a5fa',
  '#f43f5e',
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#ef4444',
];

const ghostInputClass = 'w-full text-[13px] text-[var(--fin-text)]';
const dropdownInputClass = 'py-0 text-[13px] font-medium text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]';

export function EditCategoryModal({ categoryId, initialValues, groups, onClose, onSaved }: EditCategoryModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<EditCategoryValues>({
    resolver: zodResolver(EditCategorySchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: EditCategoryValues) {
    await apiFetch<CategoryMutationResponse, CategoryUpdateBody>(`/api/finances/categories/${categoryId}`, {
      method: 'PATCH',
      body: formToCategoryBody(values),
    });
    onSaved();
  }

  return (
    <FinModalShell
      onClose={onClose}
      title="Edit Category"
      className="md:max-w-[400px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Save"
      submitLoading={isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <FinFieldCard label="Name">
          <Input
            {...register('name')}
            placeholder="e.g. Groceries"
            autoFocus
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>

        <Controller
          name="icon"
          control={control}
          render={({ field }) => (
            <FinFieldCard label="Icon">
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {ICON_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(field.value === opt.value ? '' : opt.value)}
                    title={opt.label}
                    className={`min-w-9 cursor-pointer rounded-md px-[7px] py-1 text-sm ${field.value === opt.value ? 'bg-[var(--fin-accent-d)]' : 'bg-[var(--fin-card2)]'}`}
                    style={{
                      border: `1px solid ${field.value === opt.value ? 'var(--fin-accent)44' : 'var(--fin-border)'}`,
                    }}
                  >
                    {opt.emoji}
                  </button>
                ))}
              </div>
              {errors.icon && <p className="mt-1 text-xs text-red-400">{errors.icon.message}</p>}
            </FinFieldCard>
          )}
        />

        <Controller
          name="color"
          control={control}
          render={({ field }) => (
            <FinFieldCard label="Color">
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => field.onChange(c)}
                    className="h-6 w-6 shrink-0 cursor-pointer rounded-full"
                    style={{
                      background: c,
                      border: field.value === c ? '2px solid var(--fin-text)' : '2px solid transparent',
                    }}
                  />
                ))}
                <ColorPicker value={field.value} onChange={e => field.onChange(e.target.value)} />
              </div>
            </FinFieldCard>
          )}
        />

        <FinFieldCard label="Monthly Target (optional)">
          <Input
            {...register('monthlyTarget')}
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 500"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>

        <FinFieldCard label="Notes (optional)">
          <Textarea
            {...register('notes')}
            rows={3}
            placeholder="Context, budgeting intent, or reminders"
            className="resize-none bg-transparent border-0 px-0 py-0 rounded-none shadow-none text-[13px] text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)] focus:ring-0 focus:outline-none w-full"
          />
        </FinFieldCard>

        <FinFieldCard label="Group (optional)">
          <Controller
            name="groupId"
            control={control}
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={groups.map(g => ({ id: String(g.id), value: g.name }))}
                value={field.value || undefined}
                onChange={item => field.onChange(item?.id ?? '')}
                placeholder="— None —"
                clearable
                inputClassName={dropdownInputClass}
              />
            )}
          />
        </FinFieldCard>
      </form>
    </FinModalShell>
  );
}
