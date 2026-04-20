'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SectionCard } from '@/components/SectionCard';
import { Button, Field, Input, Select } from '@/components';
import { COUNTRIES, TIMEZONES } from '@my-hub/shared/constants';
import { apiFetch } from '@/lib/utils';
import { PersonalInfoFormSchema } from './personal-info-form.schema';
import type { PersonalInfoFormValues } from './personal-info-form.schema';

const COUNTRY_LABELS = Object.fromEntries(COUNTRIES.map(c => [c.value, c.label]));
const TIMEZONE_LABELS = Object.fromEntries(TIMEZONES.map(t => [t.value, t.label]));

export function PersonalInfoSection() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<PersonalInfoFormValues | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(PersonalInfoFormSchema),
    defaultValues: { name: '', country: '', timezone: '' },
  });

  useEffect(() => {
    apiFetch<{ user: { name: string | null; country: string | null; timezone: string | null } }>('/api/users/profile')
      .then(data => {
        const values = {
          name: data.user.name ?? '',
          country: data.user.country ?? '',
          timezone: data.user.timezone ?? '',
        };
        setSaved(values);
        reset(values);
      })
      .catch(() => {});
  }, [reset]);

  function openEdit() {
    setEditing(true);
  }

  async function save(values: PersonalInfoFormValues) {
    await apiFetch('/api/users/profile', {
      method: 'PUT',
      body: { name: values.name || null, country: values.country || null, timezone: values.timezone || null },
    });
    setSaved(values);
    setEditing(false);
  }

  function cancel() {
    if (saved) reset(saved);
    setEditing(false);
  }

  const editAction = !editing && (
    <Button
      variant="ghost"
      size="xs"
      onClick={openEdit}
      className="rounded-md border border-zinc-700 px-2.5 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700/60 hover:text-white"
    >
      Edit
    </Button>
  );

  return (
    <SectionCard title="Personal information" action={editAction}>
      {!editing ? (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Name</span>
            <span className="font-medium">{saved?.name || <span className="text-zinc-500">—</span>}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Country</span>
            <span className="font-medium">
              {saved?.country ? (
                (COUNTRY_LABELS[saved.country] ?? saved.country)
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Timezone</span>
            <span className="font-medium">
              {saved?.timezone ? (
                (TIMEZONE_LABELS[saved.timezone] ?? saved.timezone)
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(save)} className="space-y-3">
          <Field label="Name">
            <Input placeholder="Enter your name" {...register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <Select {...register('country')} options={COUNTRIES}>
                <option value="">— not set —</option>
              </Select>
            </Field>
            <Field label="Timezone">
              <Select {...register('timezone')} options={TIMEZONES}>
                <option value="">— not set —</option>
              </Select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
