'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CalorieProfile } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { dateToString, latestWeightKg } from '@my-hub/shared/utils';
import { MeasurementTypes, GoalTypes, Sexes } from '@my-hub/shared/constants';
import { Card, Field, Button, Input, Select, Textarea } from '@/components';
import { pctToGrams, gramsToPct, computeMacroSummary } from './calories.utils';
import {
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_OPTIONS,
  FIELD_INFO,
  GOAL_OPTIONS,
  ProfileFormSchema,
  buildFormValues,
  formToProfileBody,
  type MacroMode,
  type ProfileFormValues,
} from './profile-form.schema';
import { ProfileSummary } from './ProfileSummary';
import { MacroGoalField } from './MacroGoalField';
import { GymFields } from './GymFields';

interface Props {
  profile: CalorieProfile | null;
  latestMeasurements: MeasurementWithType[];
  /** Reloads the profile; awaited before the card leaves edit mode so it never shows stale values. */
  onUpdated: () => void | Promise<void>;
}

export function ProfileCard({ profile, latestMeasurements, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [macroMode, setMacroMode] = useState<MacroMode>('g');
  const currentWeight = latestWeightKg(latestMeasurements) ?? undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { isSubmitting, errors, dirtyFields },
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

  const showRate = goalType === GoalTypes.WeightLoss || goalType === GoalTypes.WeightGain;
  const maxCalNum = goalMaxCalories ? Math.round(Number(goalMaxCalories)) : null;
  const macroSummary = computeMacroSummary(macroMode, goalProtein, goalCarbs, goalFat, maxCalNum);

  const macroWarning = macroSummary?.isOver ?? null;

  function switchMacroMode(next: MacroMode) {
    if (next === macroMode) return;
    const curMaxCal = maxCalNum ?? 0;
    const convert = next === '%' ? gramsToPct : pctToGrams;
    setValue('goalProtein', convert(goalProtein, 4, curMaxCal));
    setValue('goalCarbs', convert(goalCarbs, 4, curMaxCal));
    setValue('goalFat', convert(goalFat, 9, curMaxCal));
    setMacroMode(next);
  }

  async function save(values: ProfileFormValues) {
    // A new weight is a measurement, not a profile field, so it goes to its own endpoint — and
    // only when it actually changed, so re-saving the form doesn't stamp a duplicate entry into
    // the weight history and flatten the trend chart. "Changed" is against the weight the form opened
    // with, not the live one: the profile reloads on tab focus, and a newer weigh-in logged through
    // Claude meanwhile must not be overwritten by the one the form still holds.
    const enteredWeight = values.weightKg ? Number(values.weightKg) : null;
    const weightWrite =
      enteredWeight !== null && dirtyFields.weightKg
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
      body: formToProfileBody(values, macroMode, maxCalNum),
    });

    await Promise.all([weightWrite, profileWrite]);
    // Reload before leaving edit mode: reopening Edit straight away must start from the saved values,
    // not from the profile prop as it was before the save.
    await onUpdated();
    setEditing(false);
  }

  function openEdit() {
    reset(buildFormValues(profile, currentWeight));
    setMacroMode('g');
    setEditing(true);
  }

  if (!editing) {
    return (
      <Card className="p-0! overflow-hidden">
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
          <ProfileSummary profile={profile} currentWeight={currentWeight} />
        </div>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="p-0! overflow-hidden">
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
              <Input type="number" step="any" placeholder="e.g. 175" {...register('heightCm')} />
            </Field>
            <Field label="Weight (kg)" info={FIELD_INFO.weight}>
              <Input type="number" step="any" min="0" placeholder="e.g. 78" {...register('weightKg')} />
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

          <GymFields control={control} register={register} />

          <p className="text-xs font-semibold text-[var(--subtle)] uppercase tracking-wide pt-1">Goal</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal type" className={showRate ? '' : 'col-span-2'}>
              <Controller
                control={control}
                name="goalType"
                render={({ field }) => (
                  <Select
                    {...field}
                    options={GOAL_OPTIONS}
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
              <Field label="Rate (kg/week)" info={FIELD_INFO.goalWeeklyRate}>
                {/*
                 * `step="any"` on every decimal field here is load-bearing, not cosmetic. A step of
                 * 0.1 made a stored rate of 0.75 — which `calories_update_profile` accepts, and
                 * which is a common choice — fail native constraint validation, and the browser
                 * then blocks submit before React sees it: no error, no request, the whole profile
                 * form silently unsaveable. The form must be able to save back whatever the rest of
                 * the system stored, so it constrains range but never granularity.
                 */}
                <Input
                  type="number"
                  step="any"
                  min="0.1"
                  max="2"
                  placeholder="e.g. 0.5"
                  {...register('goalWeeklyRateKg')}
                />
              </Field>
            )}
            {showRate && (
              <Field label="Goal weight (kg)" className="col-span-2" info={FIELD_INFO.goalTargetWeight}>
                <Input type="number" step="any" min="0" placeholder="Optional" {...register('goalTargetWeightKg')} />
              </Field>
            )}
            <Field label="Min calories/day" info={FIELD_INFO.goalMinCalories}>
              <Input type="number" step="1" min="0" placeholder="Optional" {...register('goalMinCalories')} />
              {errors.goalMinCalories && (
                <p role="alert" className="mt-0.5 text-xs text-[var(--red)]">
                  {errors.goalMinCalories.message}
                </p>
              )}
            </Field>
            <Field label="Max calories/day" info={FIELD_INFO.goalMaxCalories}>
              <Controller
                control={control}
                name="goalMaxCalories"
                render={({ field }) => (
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional"
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

            <MacroGoalField
              label="Protein"
              kcalPerGram={4}
              value={goalProtein}
              macroMode={macroMode}
              maxCalNum={maxCalNum}
              registration={register('goalProtein')}
            />
            <MacroGoalField
              label="Carbs"
              kcalPerGram={4}
              value={goalCarbs}
              macroMode={macroMode}
              maxCalNum={maxCalNum}
              registration={register('goalCarbs')}
            />
            <MacroGoalField
              label="Fat"
              kcalPerGram={9}
              value={goalFat}
              macroMode={macroMode}
              maxCalNum={maxCalNum}
              registration={register('goalFat')}
            />
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
