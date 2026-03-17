'use client';

import { useState } from 'react';
import type { CalorieProfile } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets } from '@my-hub/shared/utils';
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

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Lose weight',
  maintain: 'Maintain',
  weight_gain: 'Gain weight',
};

export default function ProfileCard({ profile, latestMeasurements, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    age: profile?.age?.toString() ?? '',
    sex: profile?.sex ?? '',
    heightCm: profile?.heightCm?.toString() ?? '',
    activityLevel: profile?.activityLevel ?? '',
    goalType: profile?.goalType ?? '',
    goalWeeklyRateKg: profile?.goalWeeklyRateKg?.toString() ?? '',
    goalMinCalories: profile?.goalMinCalories?.toString() ?? '',
    goalMaxCalories: profile?.goalMaxCalories?.toString() ?? '',
    notes: profile?.notes ?? '',
  });

  const weightMeasure = latestMeasurements.find((m) => m.typeKey === 'weight');

  const targets = calculateCalorieTargets({
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: weightMeasure?.value ?? null,
    activityLevel: profile?.activityLevel ?? null,
    goalType: profile?.goalType ?? null,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? null,
    goalMinCalories: profile?.goalMinCalories ?? null,
    goalMaxCalories: profile?.goalMaxCalories ?? null,
  });

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
          heightCm: form.heightCm ? Number(form.heightCm) : undefined,
          activityLevel: form.activityLevel || undefined,
          goalType: form.goalType || undefined,
          goalWeeklyRateKg: form.goalWeeklyRateKg ? Number(form.goalWeeklyRateKg) : undefined,
          goalMinCalories: form.goalMinCalories ? Number(form.goalMinCalories) : undefined,
          goalMaxCalories: form.goalMaxCalories ? Number(form.goalMaxCalories) : undefined,
          notes: form.notes || undefined,
        }),
      });
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  function openEdit() {
    setForm({
      name: profile?.name ?? '',
      age: profile?.age?.toString() ?? '',
      sex: profile?.sex ?? '',
      heightCm: profile?.heightCm?.toString() ?? '',
      activityLevel: profile?.activityLevel ?? '',
      goalType: profile?.goalType ?? '',
      goalWeeklyRateKg: profile?.goalWeeklyRateKg?.toString() ?? '',
      goalMinCalories: profile?.goalMinCalories?.toString() ?? '',
      goalMaxCalories: profile?.goalMaxCalories?.toString() ?? '',
      notes: profile?.notes ?? '',
    });
    setEditing(true);
  }

  const showRate = form.goalType === 'weight_loss' || form.goalType === 'weight_gain';

  return (
    <SectionCard
      title="Profile"
      action={
        !editing && (
          <button onClick={openEdit} className="text-sm text-indigo-400 hover:underline">
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
          <Row label="Height" value={profile?.heightCm ? `${profile.heightCm} cm` : undefined} />
          <Row label="Weight" value={weightMeasure ? `${weightMeasure.value} kg` : undefined} />

          {/* Calorie targets */}
          {(targets.tdee || targets.goalCalories || targets.minCalories || targets.maxCalories) && (
            <div className="col-span-2 mt-2 space-y-2">
              {targets.tdee && (
                <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-2 text-sm">
                  <span className="text-zinc-400">TDEE</span>
                  <span className="font-medium text-zinc-300">{targets.tdee} kcal</span>
                </div>
              )}
              {targets.goalCalories && targets.goalCalories !== targets.tdee && (
                <div className="rounded-lg bg-blue-950/30 border border-blue-800/50 px-4 py-3 text-center">
                  <span className="text-xs text-blue-400 uppercase tracking-wide">Goal target</span>
                  <p className="text-2xl font-bold text-blue-300">{targets.goalCalories} kcal/day</p>
                  {profile?.goalType && (
                    <p className="text-xs text-blue-400 mt-0.5">
                      {GOAL_LABELS[profile.goalType]}
                      {profile.goalWeeklyRateKg ? ` · ${profile.goalWeeklyRateKg} kg/week` : ''}
                    </p>
                  )}
                </div>
              )}
              {targets.goalCalories && targets.goalCalories === targets.tdee && (
                <div className="rounded-lg bg-blue-950/30 border border-blue-800/50 px-4 py-3 text-center">
                  <span className="text-xs text-blue-400 uppercase tracking-wide">Daily target</span>
                  <p className="text-2xl font-bold text-blue-300">{targets.tdee} kcal</p>
                  {profile?.goalType === 'maintain' && <p className="text-xs text-blue-400 mt-0.5">Maintain weight</p>}
                </div>
              )}
              {targets.minCalories && (
                <div className="flex items-center justify-between rounded-lg bg-green-950/30 border border-green-800/50 px-4 py-2 text-sm">
                  <span className="text-green-400">Floor (min)</span>
                  <span className="font-medium text-green-300">{targets.minCalories} kcal</span>
                </div>
              )}
              {targets.maxCalories && targets.maxCalories !== targets.goalCalories && (
                <div className="flex items-center justify-between rounded-lg bg-orange-950/30 border border-orange-800/50 px-4 py-2 text-sm">
                  <span className="text-orange-400">Ceiling (max)</span>
                  <span className="font-medium text-orange-300">{targets.maxCalories} kcal</span>
                </div>
              )}
            </div>
          )}

          {profile?.notes && <div className="col-span-2 text-zinc-400 text-xs mt-1">{profile.notes}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Age">
              <input
                className="input"
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </Field>
            <Field label="Sex">
              <select className="input" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Height (cm)">
              <input
                className="input"
                type="number"
                placeholder="e.g. 175"
                value={form.heightCm}
                onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
              />
            </Field>
            <Field label="Activity level">
              <select
                className="input"
                value={form.activityLevel}
                onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
              >
                <option value="">—</option>
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly active</option>
                <option value="moderately_active">Moderately active</option>
                <option value="very_active">Very active</option>
                <option value="extra_active">Extra active</option>
              </select>
            </Field>
          </div>

          {/* Goals section */}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Goal</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal type" className={showRate ? '' : 'col-span-2'}>
              <select
                className="input"
                value={form.goalType}
                onChange={(e) => setForm({ ...form, goalType: e.target.value, goalWeeklyRateKg: '' })}
              >
                <option value="">— no goal —</option>
                <option value="weight_loss">Lose weight</option>
                <option value="maintain">Maintain</option>
                <option value="weight_gain">Gain weight</option>
              </select>
            </Field>
            {showRate && (
              <Field label="Rate (kg/week)">
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2"
                  placeholder="e.g. 0.5"
                  value={form.goalWeeklyRateKg}
                  onChange={(e) => setForm({ ...form, goalWeeklyRateKg: e.target.value })}
                />
              </Field>
            )}
            <Field label="Min calories/day">
              <input
                className="input"
                type="number"
                placeholder="Optional floor"
                value={form.goalMinCalories}
                onChange={(e) => setForm({ ...form, goalMinCalories: e.target.value })}
              />
            </Field>
            <Field label="Max calories/day">
              <input
                className="input"
                type="number"
                placeholder="Optional ceiling"
                value={form.goalMaxCalories}
                onChange={(e) => setForm({ ...form, goalMaxCalories: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes" className="col-span-2">
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex gap-2">
            <Button onClick={save} loading={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium">{value ?? <span className="text-zinc-600">—</span>}</span>
    </>
  );
}
