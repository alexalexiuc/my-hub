'use client';

import { useState } from 'react';
import type { CalorieProfile } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import SectionCard from '@/components/section-card';
import Field from '@/components/field';
import Button from '@/components/button';

interface Props {
  profile: CalorieProfile | null;
  latestMeasurements: MeasurementWithType[];
  onUpdated: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
  extra_active: 'Extra active',
};

function calcTDEE(
  age: number | null,
  sex: string | null,
  heightCm: number | null,
  weightKg: number | null,
  activity: string | null,
  override: number | null,
): number | null {
  if (!age || !sex || !heightCm || !weightKg) return null;
  let bmr: number;
  if (sex === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };
  const m = activity ? (multipliers[activity] ?? 1.2) : 1.2;
  if (override && override > 0) return override;
  return Math.round(bmr * m);
}

export default function ProfileCard({ profile, latestMeasurements, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    age: profile?.age?.toString() ?? '',
    sex: profile?.sex ?? '',
    activityLevel: profile?.activityLevel ?? '',
    goalCaloriesOverride: profile?.goalCaloriesOverride?.toString() ?? '',
    notes: profile?.notes ?? '',
  });

  const heightMeasure = latestMeasurements.find((m) => m.typeKey === 'height');
  const weightMeasure = latestMeasurements.find((m) => m.typeKey === 'weight');

  const tdee = calcTDEE(
    profile?.age ?? null,
    profile?.sex ?? null,
    heightMeasure?.value ?? null,
    weightMeasure?.value ?? null,
    profile?.activityLevel ?? null,
    profile?.goalCaloriesOverride ?? null,
  );

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/calories/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || undefined,
          age: form.age ? Number(form.age) : undefined,
          sex: form.sex || undefined,
          activityLevel: form.activityLevel || undefined,
          goalCaloriesOverride: form.goalCaloriesOverride ? Number(form.goalCaloriesOverride) : undefined,
          notes: form.notes || undefined,
        }),
      });
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Profile"
      action={
        !editing && (
          <button
            onClick={() => {
              setForm({
                name: profile?.name ?? '',
                age: profile?.age?.toString() ?? '',
                sex: profile?.sex ?? '',
                activityLevel: profile?.activityLevel ?? '',
                goalCaloriesOverride: profile?.goalCaloriesOverride?.toString() ?? '',
                notes: profile?.notes ?? '',
              });
              setEditing(true);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Edit
          </button>
        )
      }
    >
      {!editing ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Row label="Name" value={profile?.name} />
          <Row label="Age" value={profile?.age?.toString()} />
          <Row label="Sex" value={profile?.sex} />
          <Row label="Activity" value={profile?.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] : undefined} />
          <Row label="Height" value={heightMeasure ? `${heightMeasure.value} cm` : undefined} />
          <Row label="Weight" value={weightMeasure ? `${weightMeasure.value} kg` : undefined} />
          {tdee && (
            <div className="col-span-2 mt-2 rounded-lg bg-blue-50 px-4 py-3 text-center">
              <span className="text-xs text-blue-600 uppercase tracking-wide">Daily target</span>
              <p className="text-2xl font-bold text-blue-700">{tdee} kcal</p>
              {profile?.goalCaloriesOverride && (
                <p className="text-xs text-blue-500">(manual override)</p>
              )}
            </div>
          )}
          {profile?.notes && (
            <div className="col-span-2 text-gray-500 text-xs mt-1">{profile.notes}</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Age">
              <input className="input" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </Field>
            <Field label="Sex">
              <select className="input" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Activity level">
              <select className="input" value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}>
                <option value="">—</option>
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly active</option>
                <option value="moderately_active">Moderately active</option>
                <option value="very_active">Very active</option>
                <option value="extra_active">Extra active</option>
              </select>
            </Field>
            <Field label="Calorie goal override" className="col-span-2">
              <input
                className="input"
                type="number"
                placeholder="Leave blank to use calculated TDEE"
                value={form.goalCaloriesOverride}
                onChange={(e) => setForm({ ...form, goalCaloriesOverride: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} loading={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value ?? <span className="text-gray-300">—</span>}</span>
    </>
  );
}
