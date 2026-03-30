'use client';

import { useState } from 'react';
import type { CalorieProfile, User } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { calculateCalorieTargets, calculateBMR } from '@my-hub/shared/utils';
import { COUNTRIES, TIMEZONES } from '@my-hub/shared/constants';
import { SectionCard, Field, Button } from '@/components';

interface Props {
  profile: CalorieProfile | null;
  userProfile: Pick<User, 'country' | 'timezone'> | null;
  latestMeasurements: MeasurementWithType[];
  onUpdated: () => void;
}

const ACTIVITY_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise, desk job' },
  { value: 'lightly_active', label: 'Lightly active', description: 'Light exercise 1–3 days/week' },
  { value: 'moderately_active', label: 'Moderately active', description: 'Moderate exercise 3–5 days/week' },
  { value: 'very_active', label: 'Very active', description: 'Hard exercise 6–7 days/week' },
  { value: 'extra_active', label: 'Extra active', description: 'Very hard exercise, physical job' },
];

const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(ACTIVITY_OPTIONS.map((o) => [o.value, o.label]));

const ACTIVITY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map((o) => [o.value, o.description]),
);

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Lose weight',
  maintain: 'Maintain',
  weight_gain: 'Gain weight',
};

const TIMEZONE_LABELS: Record<string, string> = Object.fromEntries(TIMEZONES.map((t) => [t.value, t.label]));
const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.value, c.label]));

export function ProfileCard({ profile, userProfile, latestMeasurements, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    age: profile?.age?.toString() ?? '',
    sex: profile?.sex ?? '',
    heightCm: profile?.heightCm?.toString() ?? '',
    activityLevel: profile?.activityLevel ?? '',
    goalType: profile?.goalType ?? '',
    goalWeeklyRateKg: profile?.goalWeeklyRateKg?.toString() ?? '',
    goalMinCalories: profile?.goalMinCalories?.toString() ?? '',
    goalMaxCalories: profile?.goalMaxCalories?.toString() ?? '',
    notes: profile?.notes ?? '',
    country: userProfile?.country ?? '',
    timezone: userProfile?.timezone ?? '',
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

  const bmr = calculateBMR(
    profile?.age ?? null,
    profile?.sex ?? null,
    profile?.heightCm ?? null,
    weightMeasure?.value ?? null,
  );
  const activeEnergy = targets.tdee !== null && bmr !== null ? targets.tdee - Math.round(bmr) : null;

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        fetch('/api/calories/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            age: form.age ? Number(form.age) : undefined,
            sex: form.sex || undefined,
            heightCm: form.heightCm ? Number(form.heightCm) : undefined,
            activityLevel: form.activityLevel || undefined,
            goalType: form.goalType || undefined,
            goalWeeklyRateKg: form.goalWeeklyRateKg ? Number(form.goalWeeklyRateKg) : undefined,
            goalMinCalories: form.goalMinCalories ? Math.round(Number(form.goalMinCalories)) : undefined,
            goalMaxCalories: form.goalMaxCalories ? Math.round(Number(form.goalMaxCalories)) : undefined,
            notes: form.notes || undefined,
          }),
        }),
        fetch('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: form.country || null,
            timezone: form.timezone || null,
          }),
        }),
      ]);
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  function openEdit() {
    setForm({
      age: profile?.age?.toString() ?? '',
      sex: profile?.sex ?? '',
      heightCm: profile?.heightCm?.toString() ?? '',
      activityLevel: profile?.activityLevel ?? '',
      goalType: profile?.goalType ?? '',
      goalWeeklyRateKg: profile?.goalWeeklyRateKg?.toString() ?? '',
      goalMinCalories: profile?.goalMinCalories?.toString() ?? '',
      goalMaxCalories: profile?.goalMaxCalories?.toString() ?? '',
      notes: profile?.notes ?? '',
      country: userProfile?.country ?? '',
      timezone: userProfile?.timezone ?? '',
    });
    setEditing(true);
  }

  const showRate = form.goalType === 'weight_loss' || form.goalType === 'weight_gain';

  if (!editing) {
    // Compact view — just key stats + edit button
    const hasProfile = profile?.age && profile?.sex && profile?.heightCm;

    return (
      <SectionCard
        title="Profile"
        action={
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-all"
          >
            Edit
          </button>
        }
      >
        {!hasProfile ? (
          <p className="text-sm text-zinc-500">Set up your profile to get personalized calorie targets.</p>
        ) : (
          <div className="space-y-3">
            {/* Inline stats row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Stat label="Age" value={`${profile!.age}`} />
              <Stat label="Sex" value={profile!.sex === 'male' ? 'Male' : 'Female'} />
              <Stat label="Height" value={`${profile!.heightCm} cm`} />
              {weightMeasure && <Stat label="Weight" value={`${weightMeasure.value} kg`} />}
              {profile!.activityLevel && (
                <Stat
                  label="Activity"
                  value={ACTIVITY_LABELS[profile!.activityLevel!] ?? profile!.activityLevel!}
                  hint={ACTIVITY_DESCRIPTIONS[profile!.activityLevel!]}
                />
              )}
              {userProfile?.timezone && (
                <Stat label="Timezone" value={TIMEZONE_LABELS[userProfile.timezone] ?? userProfile.timezone} />
              )}
              {userProfile?.country && (
                <Stat label="Country" value={COUNTRY_LABELS[userProfile.country] ?? userProfile.country} />
              )}
            </div>

            {/* Calorie targets */}
            {targets.tdee && (
              <div className="flex flex-wrap gap-3">
                {bmr !== null && <TargetPill label="Resting (BMR)" value={`${Math.round(bmr)}`} unit="kcal" />}
                {activeEnergy !== null && <TargetPill label="Active energy" value={`${activeEnergy}`} unit="kcal" />}
                <TargetPill label="TDEE" value={`${targets.tdee}`} unit="kcal" />
                {targets.goalCalories && targets.goalCalories !== targets.tdee && (
                  <TargetPill
                    label={profile?.goalType ? (GOAL_LABELS[profile.goalType] ?? 'Goal') : 'Goal'}
                    value={`${targets.goalCalories}`}
                    unit="kcal"
                    accent
                  />
                )}
                {targets.minCalories && <TargetPill label="Min" value={`${targets.minCalories}`} unit="kcal" />}
                {targets.maxCalories && targets.maxCalories !== targets.goalCalories && (
                  <TargetPill label="Max" value={`${targets.maxCalories}`} unit="kcal" />
                )}
              </div>
            )}

            {profile?.notes && <p className="text-xs text-zinc-500">{profile.notes}</p>}
          </div>
        )}
      </SectionCard>
    );
  }

  // Edit mode
  return (
    <SectionCard title="Profile">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
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
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {form.activityLevel && (
          <p className="text-xs text-zinc-500 -mt-1 px-1">{ACTIVITY_DESCRIPTIONS[form.activityLevel]}</p>
        )}

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
              step="1"
              min="0"
              placeholder="Optional floor"
              value={form.goalMinCalories}
              onChange={(e) => setForm({ ...form, goalMinCalories: e.target.value })}
            />
          </Field>
          <Field label="Max calories/day">
            <input
              className="input"
              type="number"
              step="1"
              min="0"
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

        {/* Location section */}
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Location</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country">
            <select
              className="input"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              <option value="">— not set —</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timezone">
            <select
              className="input"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              <option value="">— not set —</option>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} loading={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <span className="text-zinc-400">
      {label}: <span className="font-medium text-zinc-200">{value}</span>
      {hint && <span className="text-zinc-600 ml-1">({hint})</span>}
    </span>
  );
}

function TargetPill({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        accent ? 'bg-indigo-950/40 border border-indigo-800/50' : 'bg-zinc-800 border border-zinc-700'
      }`}
    >
      <span className="text-xs text-zinc-500">{label}</span>
      <p className={`font-bold ${accent ? 'text-indigo-300' : ''}`}>
        {value} <span className="text-xs font-normal text-zinc-500">{unit}</span>
      </p>
    </div>
  );
}
