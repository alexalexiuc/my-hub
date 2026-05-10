'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, Field, Input, Textarea } from '@/components';
import { AddGroupSchema, type AddGroupValues } from '../finances-form.schema';

export type EditGroupModalProps = {
  groupId: number;
  initialValues: AddGroupValues;
  onClose: () => void;
  onSaved: () => void;
};

export function EditGroupModal({ groupId, initialValues, onClose, onSaved }: EditGroupModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AddGroupValues>({
    resolver: zodResolver(AddGroupSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: AddGroupValues) {
    await apiFetch(`/api/finances/groups/${groupId}`, {
      method: 'PATCH',
      body: {
        name: values.name,
        notes: values.notes.trim() || null,
      },
    });
    onSaved();
  }

  return (
    <FinModalShell onClose={onClose} title="Edit Group" className="md:max-w-[360px]">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Name">
          <Input {...register('name')} placeholder="e.g. Living Expenses" autoFocus />
        </Field>

        <Field label="Notes (optional)">
          <Textarea
            {...register('notes')}
            rows={3}
            className="resize-none"
            placeholder="Shared context for this group"
          />
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
