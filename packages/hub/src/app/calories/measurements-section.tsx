'use client';

import { useState } from 'react';
import type { MeasurementType } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import SectionCard from '@/components/section-card';
import Field from '@/components/field';
import Button from '@/components/button';

interface Props {
  latestMeasurements: MeasurementWithType[];
  measurementTypes: MeasurementType[];
  onChanged: () => void;
}

export default function MeasurementsSection({ latestMeasurements, measurementTypes, onChanged }: Props) {
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
      await fetch('/api/calories/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeKey: form.typeKey,
          value: Number(form.value),
          date: form.date,
          notes: form.notes || undefined,
        }),
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
      await fetch(`/api/calories/measurements/${id}`, { method: 'DELETE' });
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
        <Button size="sm" onClick={() => setShowAdd(true)}>
          + Log measurement
        </Button>
      }
    >
      {latestMeasurements.length === 0 ? (
        <p className="text-gray-400 text-sm">No measurements recorded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {latestMeasurements.map((m) => (
            <div key={m.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 relative group">
              <p className="text-xs text-gray-500">{m.typeLabel}</p>
              <p className="text-xl font-bold mt-0.5">
                {m.value}
                <span className="text-sm font-normal text-gray-500 ml-1">{m.typeUnit}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{m.date}</p>
              <button
                onClick={() => deleteMeasurementEntry(m.id)}
                disabled={deleting === m.id}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 text-xs"
              >
                {deleting === m.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-4 border-t pt-4 space-y-3">
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
