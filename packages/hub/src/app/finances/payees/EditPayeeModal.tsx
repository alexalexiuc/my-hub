'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { Button, Field, Textarea } from '@/components';
import { FinModalShell } from '../FinModalShell';
import { EditPayeeSchema, formToPayeeBody, payeeToEditValues, type EditPayeeValues } from '../finances-form.schema';
import type { PayeeSuggestion } from '@/app/api/finances/contracts';

type EditPayeeModalProps = {
  payee: PayeeSuggestion;
  onClose: () => void;
  onSaved: () => void;
};

export function EditPayeeModal({ payee, onClose, onSaved }: EditPayeeModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EditPayeeValues>({
    resolver: zodResolver(EditPayeeSchema),
    defaultValues: payeeToEditValues(payee),
  });

  async function onSubmit(values: EditPayeeValues) {
    await apiFetch(`/api/finances/payees/${payee.id}`, {
      method: 'PATCH',
      body: formToPayeeBody(values),
    });
    onSaved();
  }

  return (
    <FinModalShell onClose={onClose} title={`Edit ${payee.name}`} className="md:max-w-[420px]">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Aliases (optional)">
          <Textarea
            {...register('aliasesText')}
            rows={5}
            placeholder={`One alias per line\n${payee.name} LLC`}
            className="font-mono text-xs"
          />
        </Field>

        <Field label="Notes (optional)">
          <Textarea {...register('notes')} rows={4} placeholder="Optional context for AI matching and future edits" />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </FinModalShell>
  );
}
