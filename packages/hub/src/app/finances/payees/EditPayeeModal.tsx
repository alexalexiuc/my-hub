'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Field, Input, Textarea } from '@/components';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';

const EditPayeeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  aliases: z.string(),
  description: z.string(),
});

type EditPayeeValues = z.infer<typeof EditPayeeSchema>;

type EditPayeeModalProps = {
  payee: PayeeWithSuggestion;
  onClose: () => void;
  onSaved: () => void;
};

export function EditPayeeModal({ payee, onClose, onSaved }: EditPayeeModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<EditPayeeValues>({
    resolver: zodResolver(EditPayeeSchema),
    defaultValues: {
      name: payee.name,
      aliases: payee.aliases?.join(', ') ?? '',
      description: payee.description ?? '',
    },
  });

  async function onSubmit(values: EditPayeeValues) {
    await apiFetch(`/api/finances/payees/${payee.id}`, {
      method: 'PATCH',
      body: {
        name: values.name,
        aliases: values.aliases
          .split(',')
          .map(a => a.trim())
          .filter(Boolean),
        description: values.description.trim() || null,
      },
    });
    onSaved();
  }

  return (
    <FinModalShell
      onClose={onClose}
      title="Edit Payee"
      className="md:max-w-[420px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Save"
      submitLoading={isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Name">
          <Input {...register('name')} autoFocus placeholder="e.g. Kaufland" />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
        </Field>

        <Field label="Aliases (optional, comma-separated)">
          <Input {...register('aliases')} placeholder="e.g. Kaufland SRL, Kaufland Romania, KL" />
        </Field>

        <Field label="Description (optional)">
          <Textarea
            {...register('description')}
            rows={3}
            className="resize-none"
            placeholder="Helpful context for matching this payee"
          />
        </Field>
      </form>
    </FinModalShell>
  );
}
