'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { GroupMutationResponse, GroupCreateBody } from '@/app/api/finances/groups/route';
import { FinModalShell } from '../FinModalShell';
import { Field, Input, Textarea } from '@/components';
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
    await apiFetch<GroupMutationResponse, GroupCreateBody>('/api/finances/groups', {
      method: 'POST',
      body: { name: values.name, notes: values.notes.trim() || null },
    });
    onCreated();
  }

  return (
    <FinModalShell
      onClose={onClose}
      title="New Group"
      className="md:max-w-[360px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Create"
      submitLoading={isSubmitting}
    >
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
      </form>
    </FinModalShell>
  );
}
