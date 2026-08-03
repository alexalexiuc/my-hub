'use client';

import { useState } from 'react';
import type { MeasurementType } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { apiFetch } from '@/lib/utils';
import { Modal, Input, SearchableSelect } from '@/components';
import { dateToString } from '@my-hub/shared/utils';
import { FieldCard } from './ui';

type MeasurementModalProps = {
  measurementTypes: MeasurementType[];
  defaultTypeKey?: string;
  /** Pass an existing entry to edit it in place; omit to log a new one. */
  measurement?: MeasurementWithType;
  onClose: () => void;
  onSaved: () => void;
};

export function MeasurementModal({
  measurementTypes,
  defaultTypeKey,
  measurement,
  onClose,
  onSaved,
}: MeasurementModalProps) {
  const isEdit = !!measurement;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    typeKey: measurement?.typeKey ?? defaultTypeKey ?? '',
    value: measurement?.value?.toString() ?? '',
    date: measurement?.date ?? dateToString(new Date()),
    notes: measurement?.notes ?? '',
  });

  const selectedType = measurementTypes.find(t => t.key === form.typeKey);

  const typeOptions = measurementTypes.map(t => ({
    id: t.key,
    value: `${t.label} (${t.unit})`,
  }));

  async function handleSubmit() {
    if (!form.typeKey || !form.value) return;
    setSaving(true);
    try {
      // `notes: null` on edit, not `undefined` — an emptied note has to clear rather than be
      // read as "leave the old one".
      await apiFetch(isEdit ? `/api/calories/measurements/${measurement.id}` : '/api/calories/measurements', {
        method: isEdit ? 'PATCH' : 'POST',
        body: {
          typeKey: form.typeKey,
          value: Number(form.value),
          date: form.date,
          notes: form.notes || (isEdit ? null : undefined),
        },
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Measurement' : 'Log Measurement'}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitLoading={saving}
      submitDisabled={!form.typeKey || !form.value}
      className="md:max-w-[380px]"
    >
      <div className="flex flex-col gap-2.5">
        <FieldCard label="Type *">
          <SearchableSelect
            options={typeOptions}
            value={form.typeKey || undefined}
            onChange={item => setForm(f => ({ ...f, typeKey: (item?.id as string) ?? '' }))}
            placeholder="Search types…"
            inputClassName="text-[13px]"
          />
        </FieldCard>

        <FieldCard label={`Value${selectedType ? ` (${selectedType.unit})` : ''} *`}>
          <Input
            type="number"
            step="0.1"
            value={form.value}
            onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            placeholder="0"
            variant="ghost"
            autoFocus={!!defaultTypeKey}
            className="w-full text-[13px]"
          />
        </FieldCard>

        <div className="grid grid-cols-2 gap-2.5">
          <FieldCard label="Date">
            <Input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Notes">
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="optional"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
        </div>
      </div>
    </Modal>
  );
}
