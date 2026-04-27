'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { Button, ColorPicker, Field, Input, Select } from '@/components';
import { CategoryIcons } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';
import {
  AddCategorySchema,
  defaultAddCategoryValues,
  formToCategoryBody,
  type AddCategoryValues,
} from '../finances-form.schema';

type GroupOption = { id: number; name: string };

type AddCategoryModalProps = {
  groups: GroupOption[];
  defaultGroupId?: number | null;
  onClose: () => void;
  onCreated: () => void;
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
];

const ICON_OPTIONS: { value: CategoryIcon; emoji: string; label: string }[] = [
  { value: CategoryIcons.ShoppingCart, emoji: '🛒', label: 'Groceries' },
  { value: CategoryIcons.UtensilsCrossed, emoji: '🍽', label: 'Dining' },
  { value: CategoryIcons.Coffee, emoji: '☕', label: 'Coffee' },
  { value: CategoryIcons.Car, emoji: '🚗', label: 'Car' },
  { value: CategoryIcons.Bus, emoji: '🚌', label: 'Transit' },
  { value: CategoryIcons.Plane, emoji: '✈️', label: 'Travel' },
  { value: CategoryIcons.Motorbike, emoji: '🏍', label: 'Motorbike' },
  { value: CategoryIcons.Home, emoji: '🏠', label: 'Home' },
  { value: CategoryIcons.Zap, emoji: '⚡', label: 'Utilities' },
  { value: CategoryIcons.Wifi, emoji: '📶', label: 'Internet' },
  { value: CategoryIcons.Heart, emoji: '❤️', label: 'Health' },
  { value: CategoryIcons.Pill, emoji: '💊', label: 'Pharmacy' },
  { value: CategoryIcons.Tv, emoji: '📺', label: 'TV' },
  { value: CategoryIcons.Music, emoji: '🎵', label: 'Music' },
  { value: CategoryIcons.Gamepad2, emoji: '🎮', label: 'Gaming' },
  { value: CategoryIcons.Banknote, emoji: '💵', label: 'Cash' },
  { value: CategoryIcons.TrendingUp, emoji: '📈', label: 'Invest' },
  { value: CategoryIcons.CreditCard, emoji: '💳', label: 'Card' },
  { value: CategoryIcons.ShoppingBag, emoji: '🛍', label: 'Shopping' },
  { value: CategoryIcons.Gift, emoji: '🎁', label: 'Gifts' },
  { value: CategoryIcons.BookOpen, emoji: '📖', label: 'Education' },
  { value: CategoryIcons.Briefcase, emoji: '💼', label: 'Work' },
  { value: CategoryIcons.Tag, emoji: '🏷', label: 'Other' },
  { value: CategoryIcons.MoreHorizontal, emoji: '•••', label: 'Misc' },
];

export function AddCategoryModal({ groups, defaultGroupId, onClose, onCreated }: AddCategoryModalProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<AddCategoryValues>({
    resolver: zodResolver(AddCategorySchema),
    defaultValues: defaultAddCategoryValues(defaultGroupId),
  });

  async function onSubmit(values: AddCategoryValues) {
    await apiFetch('/api/finances/categories', {
      method: 'POST',
      body: formToCategoryBody(values),
    });
    onCreated();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--fin-overlay)]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Category</div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Field label="Name">
            <Input {...register('name')} placeholder="e.g. Groceries" autoFocus />
          </Field>

          <Controller
            name="icon"
            control={control}
            render={({ field }) => (
              <Field label="Icon">
                <div className="flex flex-wrap gap-1.5">
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
              </Field>
            )}
          />

          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <Field label="Color">
                <div className="flex flex-wrap items-center gap-2">
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
              </Field>
            )}
          />

          <Field label="Monthly Target (optional)">
            <Input {...register('monthlyTarget')} type="number" step="0.01" min="0" placeholder="e.g. 500" />
          </Field>

          <Field label="Group (optional)">
            <Select {...register('groupId')}>
              <option value="">— None —</option>
              {groups.map(g => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
