'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { AccountCreateData, AccountMutationResponse } from '@/app/api/finances/accounts/route';
import { FinModalShell } from '../FinModalShell';
import { Field, Input } from '@/components';
import { AddGoalSchema, defaultAddGoalValues, formToGoalBody, type AddGoalValues } from '../finances-form.schema';
import { SupportedCurrency } from '@my-hub/shared/constants';

type AddGoalModalProps = {
  defaultCurrency: SupportedCurrency;
  onClose: () => void;
  onCreated: () => void;
};

export function AddGoalModal({ defaultCurrency, onClose, onCreated }: AddGoalModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AddGoalValues>({
    resolver: zodResolver(AddGoalSchema),
    defaultValues: defaultAddGoalValues,
  });

  async function onSubmit(values: AddGoalValues) {
    await apiFetch<AccountMutationResponse, AccountCreateData>('/api/finances/accounts', {
      method: 'POST',
      body: { ...formToGoalBody(values), currency: defaultCurrency },
    });
    onCreated();
  }

  return (
    <FinModalShell
      onClose={onClose}
      title="New Goal"
      className="md:max-w-[420px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Create Goal"
      submitLoading={isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Goal Name">
          <Input {...register('name')} placeholder="e.g. Emergency Fund" autoFocus />
        </Field>

        <Field label="Target Amount">
          <Input {...register('targetAmount')} type="number" step="0.01" min="0" placeholder="10000" />
        </Field>

        <Field label="Current Savings">
          <Input {...register('openingBalance')} type="number" step="0.01" min="0" placeholder="0" />
        </Field>
      </form>
    </FinModalShell>
  );
}
