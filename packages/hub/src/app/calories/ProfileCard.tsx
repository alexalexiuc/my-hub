'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CalorieProfile } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { profileToTargets, calculateBMR, dateToString, latestWeightKg } from '@my-hub/shared/utils';
import {
  MeasurementTypes,
  ActivityLevel,
  ActivityLevels,
  GoalType,
  GoalTypes,
  Sexes,
  DaysOfWeek,
  DaysOfWeekValues,
  DAY_LABELS,
  DAY_LABELS_SHORT,
  GymTimesValues,
  GYM_TIME_LABELS,
} from '@my-hub/shared/constants';
import { Card, Field, Button, Input, Select, Textarea } from '@/components';
import { pctToGrams, gramsToPct, computeMacroSummary } from './calories.utils';

interface Props {
  profile: CalorieProfile | null;
  latestMeasurements: MeasurementWithType[];
  onUpdated: () => void;
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: ActivityLevels.Sedentary, label: 'Sedentary', description: 'Little or no exercise, desk job' },
  { value: ActivityLevels.LightlyActive, label: 'Lightly active', description: 'Light exercise 1-3 days/week' },
  {
    value: ActivityLevels.ModeratelyActive,
    label: 'Moderately active',
    description: 'Moderate exercise 3-5 days/week',
  },
  { value: ActivityLevels.VeryActive, label: 'Very active', description: 'Hard exercise 6-7 days/week' },
  { value: ActivityLevels.ExtraActive, label: 'Extra active', description: 'Very hard exercise, physical job' },
];

const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(ACTIVITY_OPTIONS.map(o => [o.value, o.label]));
const ACTIVITY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map(o => [o.value, o.description]),
);

const GYM_TIME_OPTIONS = GymTimesValues.map(value => ({ value, label: GYM_TIME_LABELS[value] }));

const GOAL_LABELS: Record<GoalType, string> = {
  [GoalTypes.WeightLoss]: 'Lose weight',
  [GoalTypes.Maintain]: 'Maintain',
  [GoalTypes.WeightGain]: 'Gain weight',
};

const ProfileFormSchema = z.object({
  age: z.string(),
  sex: z.string(),
  heightCm: z.string(),
  /**
   * Weight is not a profile column — it is the latest `weight` measurement, and saving the form
   * writes a new one. It lives here anyway because every calorie target depends on it: without a
   * weight the whole feature reports "no goal set", and the only place to enter one used to be a
   * modal on another tab, which this card's own "Set up profile" link did not lead to.
   */
  weightKg: z.string(),
  activityLevel: z.string(),
  goalType: z.string(),
  goalWeeklyRateKg: z.string(),
  goalMinCalories: z.string(),
  goalMaxCalories: z.string(),
  goalProtein: z.string(),
  goalCarbs: z.string(),
  goalFat: z.string(),
  gymDays: z.nativeEnum(DaysOfWeek).array(), // Using deprecated `nativeEnum` because `enum` does not support number values
  gymDayCalorieBonus: z.string(),
  gymTime: z.string(), // '' = not set; the Select's blank option
  notes: z.string(),
});

type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

function buildFormValues(profile: Props['profile'], weightKg: number | undefined): ProfileFormValues {
  return {
    age: profile?.age?.toString() ?? '',
    sex: profile?.sex ?? '',
    heightCm: profile?.heightCm?.toString() ?? '',
    weightKg: weightKg?.toString() ?? '',
    activityLevel: profile?.activityLevel ?? '',
    goalType: profile?.goalType ?? '',
    goalWeeklyRateKg: profile?.goalWeeklyRateKg?.toString() ?? '',
    goalMinCalories: profile?.goalMinCalories?.toString() ?? '',
    goalMaxCalories: profile?.goalMaxCalories?.toString() ?? '',
    goalProtein: profile?.goalProtein?.toString() ?? '',
    goalCarbs: profile?.goalCarbs?.toString() ?? '',
    goalFat: profile?.goalFat?.toString() ?? '',
    gymDays: profile?.gymDays ?? [],
    gymDayCalorieBonus: profile?.gymDayCalorieBonus?.toString() ?? '',
    gymTime: profile?.gymTime ?? '',
    notes: profile?.notes ?? '',
  };
}

export function ProfileCard({ profile, latestMeasurements, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [macroMode, setMacroMode] = useState<'g' | '%'>('g');
  const currentWeight = latestWeightKg(latestMeasurements) ?? undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: buildFormValues(profile, currentWeight),
  });

  const goalType = watch('goalType');
  const activityLevel = watch('activityLevel');
  const goalMaxCalories = watch('goalMaxCalories');
  const goalProtein = watch('goalProtein');
  const goalCarbs = watch('goalCarbs');
  const goalFat = watch('goalFat');

  const targets = profileToTargets(profile, currentWeight);

  const bmr = calculateBMR(
    profile?.age ?? null,
    profile?.sex ?? null,
    profile?.heightCm ?? null,
    currentWeight ?? null,
  );
  const activeEnergy = targets.tdee !== null && bmr !== null ? targets.tdee - Math.round(bmr) : null;

  const showRate = goalType === GoalTypes.WeightLoss || goalType === GoalTypes.WeightGain;
  const maxCalNum = goalMaxCalories ? Math.round(Number(goalMaxCalories)) : null;
  const macroSummary = computeMacroSummary(macroMode, goalProtein, goalCarbs, goalFat, maxCalNum);

  const macroWarning = macroSummary?.isOver ?? null;

  function switchMacroMode(next: 'g' | '%') {
    if (next === macroMode) return;
    const curMaxCal = maxCalNum ?? 0;
    if (next === '%') {
      setValue('goalProtein', gramsToPct(goalProtein, 4, curMaxCal));
      setValue('goalCarbs', gramsToPct(goalCarbs, 4, curMaxCal));
      setValue('goalFat', gramsToPct(goalFat, 9, curMaxCal));
    } else {
      setValue('goalProtein', pctToGrams(goalProtein, 4, curMaxCal));
      setValue('goalCarbs', pctToGrams(goalCarbs, 4, curMaxCal));
      setValue('goalFat', pctToGrams(goalFat, 9, curMaxCal));
    }
    setMacroMode(next);
  }

  async function save(values: ProfileFormValues) {
    // A new weight is a measurement, not a profile field, so it goes to its own endpoint — and
    // only when it actually changed, so re-saving the form doesn't stamp a duplicate entry into
    // the weight history and flatten the trend chart.
    const enteredWeight = values.weightKg ? Number(values.weightKg) : null;
    const weightWrite =
      enteredWeight !== null && enteredWeight !== currentWeight
        ? apiFetch('/api/calories/measurements', {
            method: 'POST',
            body: { typeKey: MeasurementTypes.Weight, value: enteredWeight, date: dateToString(new Date()) },
            silentToast: true,
          })
        : Promise.resolve();

    // Two independent tables, neither read by the other — no reason to pay for both round trips
    // in series when the user is waiting on the save.
    const profileWrite = apiFetch('/api/calories/profile', {
      method: 'PUT',
      body: {
        age: values.age ? Number(values.age) : undefined,
        sex: values.sex || undefined,
        heightCm: values.heightCm ? Number(values.heightCm) : undefined,
        activityLevel: values.activityLevel || undefined,
        goalType: values.goalType || undefined,
        goalWeeklyRateKg: values.goalWeeklyRateKg ? Number(values.goalWeeklyRateKg) : undefined,
        goalMinCalories: values.goalMinCalories ? Math.round(Number(values.goalMinCalories)) : null,
        goalMaxCalories: values.goalMaxCalories ? Math.round(Number(values.goalMaxCalories)) : null,
        goalProtein: values.goalProtein
          ? Number(macroMode === '%' ? pctToGrams(values.goalProtein, 4, maxCalNum ?? 0) : values.goalProtein)
          : null,
        goalCarbs: values.goalCarbs
          ? Number(macroMode === '%' ? pctToGrams(values.goalCarbs, 4, maxCalNum ?? 0) : values.goalCarbs)
          : null,
        goalFat: values.goalFat
          ? Number(macroMode === '%' ? pctToGrams(values.goalFat, 9, maxCalNum ?? 0) : values.goalFat)
          : null,
        gymDays: values.gymDays.length > 0 ? values.gymDays : null,
        gymDayCalorieBonus: values.gymDayCalorieBonus ? Number(values.gymDayCalorieBonus) : null,
        gymTime: values.gymTime || null,
        notes: values.notes || undefined,
      },
    });

    await Promise.all([weightWrite, profileWrite]);
    setEditing(false);
    onUpdated();
  }

  function openEdit() {
    reset(buildFormValues(profile, currentWeight));
    setMacroMode('g');
    setEditing(true);
  }

  if (!editing) {
    const hasProfile = profile?.age && profile?.sex && profile?.heightCm;

    return (
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Profile</h2>
          <Button
            variant="ghost"
            size="xs"
            onClick={openEdit}
            className="rounded-md border border-[var(--border)] px-2.5 text-[var(--muted)] hover:border-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--text)]"
          >
            Edit
          </Button>
        </div>
        <div className="p-5">
          {!hasProfile ? (
            <p className="text-sm text-[var(--subtle)]">Set up your profile to get personalized calorie targets.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <Stat label="Age" value={`${profile!.age}`} />
                <Stat label="Sex" value={profile!.sex === Sexes.Male ? 'Male' : 'Female'} />
                <Stat label="Height" value={`${profile!.heightCm} cm`} />
                {currentWeight != null && <Stat label="Weight" value={`${currentWeight} kg`} />}
                {profile!.activityLevel && (
                  <Stat
                    label="Activity"
                    value={ACTIVITY_LABELS[profile!.activityLevel!] ?? profile!.activityLevel!}
                    hint={ACTIVITY_DESCRIPTIONS[profile!.activityLevel!]}
                  />
                )}
                {profile.gymDays && profile.gymDays.length > 0 && (
                  <Stat label="Gym days" value={profile.gymDays.map(d => DAY_LABELS[d]).join(', ')} />
                )}
                {profile.gymDays && profile.gymDays.length > 0 && profile.gymDayCalorieBonus != null && (
                  <Stat label="Gym day bonus" value={`+${profile.gymDayCalorieBonus} kcal`} />
                )}
                {profile.gymDays && profile.gymDays.length > 0 && profile.gymTime && (
                  <Stat label="Training time" value={GYM_TIME_LABELS[profile.gymTime]} />
                )}
              </div>

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

              {profile?.notes && <p className="text-xs text-[var(--subtle)]">{profile.notes}</p>}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Profile</h2>
      </div>
      <div className="p-5">
        <form onSubmit={handleSubmit(save)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <Input type="number" {...register('age')} />
            </Field>
            <Field label="Sex">
              <Select
                {...register('sex')}
                options={[
                  { value: Sexes.Male, label: 'Male' },
                  { value: Sexes.Female, label: 'Female' },
                ]}
              >
                <option value="">—</option>
              </Select>
            </Field>
            <Field label="Height (cm)">
              <Input type="number" placeholder="e.g. 175" {...register('heightCm')} />
            </Field>
            <Field label="Weight (kg)">
              <Input type="number" step="0.1" min="0" placeholder="e.g. 78" {...register('weightKg')} />
              <span className="mt-1 block text-[11px] text-[var(--subtle)]">
                Saved as today&apos;s weigh-in — calorie targets need it.
              </span>
            </Field>
            <Field label="Activity level">
              <Select
                {...register('activityLevel')}
                options={ACTIVITY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              >
                <option value="">—</option>
              </Select>
            </Field>
          </div>
          {activityLevel && (
            <p className="text-xs text-[var(--subtle)] -mt-1 px-1">{ACTIVITY_DESCRIPTIONS[activityLevel]}</p>
          )}

          <div>
            <p className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-wide pt-1 pb-1.5">Gym days</p>
            <Controller
              control={control}
              name="gymDays"
              render={({ field }) => (
                <div className="flex gap-1.5 flex-wrap">
                  {DaysOfWeekValues.map(value => {
                    const active = field.value.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? field.value.filter(d => d !== value)
                            : [...field.value, value].sort((a, b) => a - b);
                          field.onChange(next);
                        }}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent-d)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
                        }`}
                      >
                        {DAY_LABELS_SHORT[value]}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <Field label="Gym day calorie bonus" className="max-w-[160px]">
                <Input type="number" step="1" min="0" placeholder="e.g. 300" {...register('gymDayCalorieBonus')} />
              </Field>
              {/* A band, not a clock time — it only decides which meals fall either side of the session */}
              <Field label="Training time" className="max-w-[160px]">
                <Select {...register('gymTime')} options={GYM_TIME_OPTIONS}>
                  <option value="">Not set</option>
                </Select>
              </Field>
            </div>
          </div>

          <p className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-wide pt-1">Goal</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal type" className={showRate ? '' : 'col-span-2'}>
              <Controller
                control={control}
                name="goalType"
                render={({ field }) => (
                  <Select
                    {...field}
                    options={[
                      { value: GoalTypes.WeightLoss, label: 'Lose weight' },
                      { value: GoalTypes.Maintain, label: 'Maintain' },
                      { value: GoalTypes.WeightGain, label: 'Gain weight' },
                    ]}
                    onChange={e => {
                      field.onChange(e);
                      setValue('goalWeeklyRateKg', '');
                    }}
                  >
                    <option value="">— no goal —</option>
                  </Select>
                )}
              />
            </Field>
            {showRate && (
              <Field label="Rate (kg/week)">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2"
                  placeholder="e.g. 0.5"
                  {...register('goalWeeklyRateKg')}
                />
              </Field>
            )}
            <Field label="Min calories/day">
              <Input type="number" step="1" min="0" placeholder="Optional floor" {...register('goalMinCalories')} />
            </Field>
            <Field label="Max calories/day">
              <Controller
                control={control}
                name="goalMaxCalories"
                render={({ field }) => (
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional ceiling"
                    value={field.value}
                    onChange={e => {
                      const val = e.target.value;
                      field.onChange(val);
                      if (!val && macroMode === '%') {
                        setMacroMode('g');
                        setValue('goalProtein', '');
                        setValue('goalCarbs', '');
                        setValue('goalFat', '');
                      }
                    }}
                  />
                )}
              />
            </Field>

            <div className="col-span-2 flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-wide">Macros</span>
              <div className="flex rounded-md border border-[var(--border)] text-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => switchMacroMode('g')}
                  className={`px-2.5 py-1 transition-colors ${macroMode === 'g' ? 'bg-[var(--card3)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                >
                  g
                </button>
                <button
                  type="button"
                  onClick={() => switchMacroMode('%')}
                  disabled={!maxCalNum}
                  title={!maxCalNum ? 'Set a max calories/day to use % mode' : undefined}
                  className={`px-2.5 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${macroMode === '%' ? 'bg-[var(--card3)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                >
                  %
                </button>
              </div>
            </div>

            {macroSummary && (
              <p
                className={`col-span-2 text-xs px-1 ${macroSummary.isOver ? 'text-[var(--amber)]' : 'text-[var(--subtle)]'}`}
              >
                Used: {macroSummary.used}% · Remaining: {macroSummary.remaining}%
              </p>
            )}

            <Field label={macroMode === 'g' ? 'Protein (g/day)' : 'Protein (%)'}>
              <Input
                type="number"
                step="1"
                min="0"
                max={macroMode === '%' ? 100 : undefined}
                placeholder="Optional"
                {...register('goalProtein')}
              />
              {macroMode === '%' && goalProtein && maxCalNum && (
                <p className="text-xs text-[var(--subtle)] mt-0.5">
                  ≈ {pctToGrams(goalProtein, 4, maxCalNum)}g ·{' '}
                  {Math.round(Number(pctToGrams(goalProtein, 4, maxCalNum)) * 4)} kcal
                </p>
              )}
              {macroMode === 'g' && goalProtein && maxCalNum && (
                <p className="text-xs text-[var(--subtle)] mt-0.5">
                  ≈ {gramsToPct(goalProtein, 4, maxCalNum)}% · {Math.round(Number(goalProtein) * 4)} kcal
                </p>
              )}
            </Field>
            <Field label={macroMode === 'g' ? 'Carbs (g/day)' : 'Carbs (%)'}>
              <Input
                type="number"
                step="1"
                min="0"
                max={macroMode === '%' ? 100 : undefined}
                placeholder="Optional"
                {...register('goalCarbs')}
              />
              {macroMode === '%' && goalCarbs && maxCalNum && (
                <p className="text-xs text-[var(--subtle)] mt-0.5">
                  ≈ {pctToGrams(goalCarbs, 4, maxCalNum)}g ·{' '}
                  {Math.round(Number(pctToGrams(goalCarbs, 4, maxCalNum)) * 4)} kcal
                </p>
              )}
              {macroMode === 'g' && goalCarbs && maxCalNum && (
                <p className="text-xs text-[var(--subtle)] mt-0.5">
                  ≈ {gramsToPct(goalCarbs, 4, maxCalNum)}% · {Math.round(Number(goalCarbs) * 4)} kcal
                </p>
              )}
            </Field>
            <Field label={macroMode === 'g' ? 'Fat (g/day)' : 'Fat (%)'}>
              <Input
                type="number"
                step="1"
                min="0"
                max={macroMode === '%' ? 100 : undefined}
                placeholder="Optional"
                {...register('goalFat')}
              />
              {macroMode === '%' && goalFat && maxCalNum && (
                <p className="text-xs text-[var(--subtle)] mt-0.5">
                  ≈ {pctToGrams(goalFat, 9, maxCalNum)}g · {Math.round(Number(pctToGrams(goalFat, 9, maxCalNum)) * 9)}{' '}
                  kcal
                </p>
              )}
              {macroMode === 'g' && goalFat && maxCalNum && (
                <p className="text-xs text-[var(--subtle)] mt-0.5">
                  ≈ {gramsToPct(goalFat, 9, maxCalNum)}% · {Math.round(Number(goalFat) * 9)} kcal
                </p>
              )}
            </Field>
          </div>

          <Field label="Notes" className="col-span-2">
            <Textarea rows={2} {...register('notes')} />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={isSubmitting} disabled={!!macroWarning}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <span className="text-[var(--muted)]">
      {label}: <span className="font-medium text-[var(--text)]">{value}</span>
      {hint && <span className="text-[var(--subtle)] ml-1">({hint})</span>}
    </span>
  );
}

function TargetPill({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        accent
          ? 'bg-[var(--accent-d)] border border-[var(--accent)44]'
          : 'bg-[var(--card2)] border border-[var(--border)]'
      }`}
    >
      <span className="text-xs text-[var(--subtle)]">{label}</span>
      <p className={`font-bold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
        {value} <span className="text-xs font-normal text-[var(--subtle)]">{unit}</span>
      </p>
    </div>
  );
}
