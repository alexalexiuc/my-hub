'use client';

import type { CalorieProfile } from '@my-hub/shared/types';
import { calculateBMR, profileToTargets } from '@my-hub/shared/utils';
import { DAY_LABELS, GYM_TIME_LABELS, Sexes } from '@my-hub/shared/constants';
import { ACTIVITY_DESCRIPTIONS, ACTIVITY_LABELS, GOAL_LABELS } from './profile-form.schema';

type ProfileSummaryProps = {
  profile: CalorieProfile | null;
  currentWeight: number | undefined;
};

/** The profile card's read view: the saved stats and the calorie targets they produce. */
export function ProfileSummary({ profile, currentWeight }: ProfileSummaryProps) {
  if (!profile?.age || !profile.sex || !profile.heightCm) {
    return <p className="text-sm text-[var(--subtle)]">Set up your profile to get personalized calorie targets.</p>;
  }

  const targets = profileToTargets(profile, currentWeight);
  const bmr = calculateBMR(profile.age, profile.sex, profile.heightCm, currentWeight ?? null);
  const activeEnergy = targets.tdee !== null && bmr !== null ? targets.tdee - Math.round(bmr) : null;
  const hasGymDays = !!profile.gymDays && profile.gymDays.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <Stat label="Age" value={`${profile.age}`} />
        <Stat label="Sex" value={profile.sex === Sexes.Male ? 'Male' : 'Female'} />
        <Stat label="Height" value={`${profile.heightCm} cm`} />
        {currentWeight != null && <Stat label="Weight" value={`${currentWeight} kg`} />}
        {profile.activityLevel && (
          <Stat
            label="Activity"
            value={ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel}
            hint={ACTIVITY_DESCRIPTIONS[profile.activityLevel]}
          />
        )}
        {hasGymDays && <Stat label="Gym days" value={profile.gymDays!.map(d => DAY_LABELS[d]).join(', ')} />}
        {hasGymDays && profile.gymDayCalorieBonus != null && (
          <Stat label="Gym day bonus" value={`+${profile.gymDayCalorieBonus} kcal`} />
        )}
        {hasGymDays && profile.gymTime && <Stat label="Training time" value={GYM_TIME_LABELS[profile.gymTime]} />}
      </div>

      {targets.tdee && (
        <div className="flex flex-wrap gap-3">
          {bmr !== null && <TargetPill label="Resting (BMR)" value={`${Math.round(bmr)}`} unit="kcal" />}
          {activeEnergy !== null && <TargetPill label="Active energy" value={`${activeEnergy}`} unit="kcal" />}
          <TargetPill label="TDEE" value={`${targets.tdee}`} unit="kcal" />
          {targets.goalCalories && targets.goalCalories !== targets.tdee && (
            <TargetPill
              label={profile.goalType ? (GOAL_LABELS[profile.goalType] ?? 'Goal') : 'Goal'}
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

      {profile.notes && <p className="text-xs text-[var(--subtle)]">{profile.notes}</p>}
    </div>
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
          ? 'bg-[var(--accent-d)] border border-[var(--accent)]'
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
