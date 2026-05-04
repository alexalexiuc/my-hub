'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, Field, Input } from '@/components';
import { AddGroupSchema, defaultAddGroupValues, type AddGroupValues } from '../finances-form.schema';

type AddGroupModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

export function AddGroupModal({ onClose, onCreated }: AddGroupModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AddGroupValues>({
    resolver: zodResolver(AddGroupSchema),
    defaultValues: defaultAddGroupValues,
  });

  async function onSubmit(values: AddGroupValues) {
    await apiFetch('/api/finances/groups', {
      method: 'POST',
      body: { name: values.name },
    });
    onCreated();
  }

  return (
    <FinModalShell onClose={onClose} title="New Group" className="md:max-w-[360px]">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Name">
          <Input {...register('name')} placeholder="e.g. Living Expenses" autoFocus />
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
    </FinModalShell>
  );
}
