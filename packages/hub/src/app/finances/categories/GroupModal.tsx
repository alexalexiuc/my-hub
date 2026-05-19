'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { GroupMutationResponse, GroupCreateBody } from '@/app/api/finances/groups/route';
import type { GroupUpdateBody } from '@/app/api/finances/groups/[id]/route';
import { FinModalShell } from '../FinModalShell';
import { Field, Input, Textarea } from '@/components';
import { AddGroupSchema, defaultAddGroupValues, type AddGroupValues } from '../finances-form.schema';

type AddMode = { groupId?: undefined; initialValues?: undefined };
type EditMode = { groupId: number; initialValues: AddGroupValues };

type GroupModalProps = (AddMode | EditMode) & {
  onClose: () => void;
  onDone: () => void;
};

export function GroupModal({ groupId, initialValues, onClose, onDone }: GroupModalProps) {
  const isEdit = groupId !== undefined;

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AddGroupValues>({
    resolver: zodResolver(AddGroupSchema),
    defaultValues: initialValues ?? defaultAddGroupValues,
  });

  async function onSubmit(values: AddGroupValues) {
    const body = { name: values.name, notes: values.notes.trim() || null };
    if (isEdit) {
      await apiFetch<GroupMutationResponse, GroupUpdateBody>(`/api/finances/groups/${groupId}`, {
        method: 'PATCH',
        body,
      });
    } else {
      await apiFetch<GroupMutationResponse, GroupCreateBody>('/api/finances/groups', {
        method: 'POST',
        body,
      });
    }
    onDone();
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={isEdit ? 'Edit Group' : 'New Group'}
      className="md:max-w-[360px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEdit ? 'Save' : 'Create'}
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
