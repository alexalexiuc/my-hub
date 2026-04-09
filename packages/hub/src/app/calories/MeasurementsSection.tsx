'use client';

import { useState } from 'react';
import type { MeasurementType } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { SectionCard } from '@/components/SectionCard';
import { Field, Button } from '@/components';
import { PlusOutlineIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';

interface Props {
  latestMeasurements: MeasurementWithType[];
  measurementTypes: MeasurementType[];
  onChanged: () => void;
}

export function MeasurementsSection({ latestMeasurements, measurementTypes, onChanged }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    typeKey: '',
    value: '',
    date: new Date().toISOString().split('T')[0]!,
    notes: '',
  });

  async function addMeasurement() {
    if (!form.typeKey || !form.value) return;
    setSaving(true);
    try {
      await apiFetch('/api/calories/measurements', {
        method: 'POST',
        body: {
          typeKey: form.typeKey,
          value: Number(form.value),
          date: form.date,
          notes: form.notes || undefined,
        },
      });
      setShowAdd(false);
      setForm({ typeKey: '', value: '', date: new Date().toISOString().split('T')[0]!, notes: '' });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function deleteMeasurementEntry(id: number) {
    setDeleting(id);
    try {
      await apiFetch(`/api/calories/measurements/${id}`, { method: 'DELETE' });
      onChanged();
    } finally {
      setDeleting(null);
    }
  }

  const selectedType = measurementTypes.find((t) => t.key === form.typeKey);

  return (
    <SectionCard
      title="Body Measurements"
      action={
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowAdd(true)}
          title="Log measurement"
          aria-label="Log measurement"
          className="flex items-center gap-1.5 px-2.5 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60"
        >
          <PlusOutlineIcon className="size-3" />
          Add
        </Button>
      }
    >
      {latestMeasurements.length === 0 ? (
        <p className="text-zinc-500 text-sm">No measurements recorded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {latestMeasurements.map((m) => (
            <div key={m.id} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 relative group">
              <p className="text-xs text-zinc-400">{m.typeLabel}</p>
              <p className="text-xl font-bold mt-0.5">
                {m.value}
                <span className="text-sm font-normal text-zinc-400 ml-1">{m.typeUnit}</span>
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{m.date}</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => deleteMeasurementEntry(m.id)}
                disabled={deleting === m.id}
                className="absolute top-2 right-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-0 py-0 hover:bg-transparent"
              >
                {deleting === m.id ? '…' : '✕'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-4 border-t border-zinc-700 pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Log measurement</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type *">
              <select
                className="input"
                value={form.typeKey}
                onChange={(e) => setForm({ ...form, typeKey: e.target.value })}
              >
                <option value="">— select —</option>
                {measurementTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} ({t.unit})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Value${selectedType ? ` (${selectedType.unit})` : ''} *`}>
              <input
                className="input"
                type="number"
                step="0.1"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </Field>
            <Field label="Date">
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={addMeasurement} loading={saving} disabled={!form.typeKey || !form.value}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
