'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--fin-overlay)]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Group</div>

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
      </div>
    </div>
  );
}
