'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { dateToString, shiftDateStr } from '@my-hub/shared/utils';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible';
import { GoalProgressCard } from '../GoalProgressCard';
import { WeightChart } from '../WeightChart';
import { MeasurementsSection } from '../MeasurementsSection';
import { PageError, PageLoading } from '../ui';
import { DEFAULT_TREND_RANGE, WEIGHT_RANGE_OPTIONS, type WeightRangeKey } from '../constants';
import { LastSevenDays } from '../LastSevenDays';
import { mealEvents } from '../mealEvents';
import { loadErrorMessage, useCalorieProfile } from '../useCalorieProfile';
import { MonthSummary } from './MonthSummary';
import { MonthCalendarModal } from './MonthCalendarModal';

/**
 * How the plan is going: this month against the daily target, the last seven days, then weight
 * against the goal and body measurements. The month calendar (what used to be the Calendar tab)
 * opens in a modal from the seven-day card, so the page stays one screen of answers; the weight
 * chart has its own range, since a goal runs over months rather than one calendar month.
 */
export default function ProgressPage() {
  const {
    profile,
    measurements: latestMeasurements,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useCalorieProfile();
  const [weightHistory, setWeightHistory] = useState<MeasurementWithType[] | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [trendRange, setTrendRange] = useState<WeightRangeKey>(DEFAULT_TREND_RANGE);

  const [showMonth, setShowMonth] = useState(false);

  /**
   * The whole weight history, fetched once and windowed client-side: smoothing needs the readings
   * before a window to enter it warm, and weigh-in rows are small. A background refresh keeps
   * what's on screen if it fails.
   */
  const loadWeights = useCallback(async (background = false) => {
    try {
      const data = await apiFetch<{ measurements: MeasurementWithType[] }>('/api/calories/measurements', {
        query: { type: 'weight', limit: 2000 },
        silentToast: background,
      });
      setWeightHistory(data.measurements);
    } catch (e) {
      if (!background) setWeightError(loadErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void loadWeights();
  }, [loadWeights]);

  /** Profile and weights together, quietly — after a weigh-in or a baseline reset. */
  async function reloadAll() {
    await Promise.all([reloadProfile(true), loadWeights(true)]);
  }

  // Weigh-ins arrive from Claude and the automation API while this page sits open (the profile
  // hook reloads itself); `changed` refreshes the month summary and the seven-day strip.
  useRefetchOnVisible(async () => {
    mealEvents.emit('changed');
    await loadWeights(true);
  });

  const error = profileError ?? (weightHistory === null ? weightError : null);
  if (error) return <PageError error={error} />;
  if (profileLoading || weightHistory === null) return <PageLoading />;

  const today = dateToString(new Date());
  const weightSamples = weightHistory.map(m => ({ date: m.date, value: m.value }));
  const trendDays = WEIGHT_RANGE_OPTIONS.find(o => o.key === trendRange)?.days ?? null;
  const trendFrom = trendDays === null ? null : shiftDateStr(today, -trendDays);
  const trendSamples = trendFrom === null ? weightSamples : weightSamples.filter(s => s.date >= trendFrom);

  /**
   * Moves the goal baseline to today at the latest weigh-in, which is how a stalled or abandoned
   * run gets forgiven — deliberately, by the user, rather than silently every Monday.
   */
  const resetGoalBaseline = async () => {
    const latest = [...weightSamples].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return;
    await apiFetch('/api/calories/profile', {
      method: 'PUT',
      body: { goalStartDate: today, goalStartWeightKg: latest.value },
    });
    await reloadAll();
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <MonthSummary profile={profile} />
      <LastSevenDays proteinGoalG={profile?.goalProtein ?? null} onOpenMonth={() => setShowMonth(true)} />
      {showMonth && <MonthCalendarModal profile={profile} onClose={() => setShowMonth(false)} />}

      {/* One weight chart: against the goal line when a goal is set, the plain trend otherwise. */}
      {profile?.goalType ? (
        <GoalProgressCard
          weightHistory={weightSamples}
          goalType={profile.goalType}
          goalWeeklyRateKg={profile.goalWeeklyRateKg ?? null}
          goalStartDate={profile.goalStartDate ?? null}
          goalStartWeightKg={profile.goalStartWeightKg ?? null}
          goalTargetWeightKg={profile.goalTargetWeightKg ?? null}
          onResetBaseline={resetGoalBaseline}
          canReset={weightSamples.length > 0}
        />
      ) : (
        <WeightChart
          data={trendSamples}
          from={trendFrom ?? weightSamples[weightSamples.length - 1]?.date ?? today}
          to={today}
          range={trendRange}
          onRangeChange={setTrendRange}
        />
      )}

      <MeasurementsSection
        latestMeasurements={latestMeasurements}
        measurementTypes={measurementTypeDefinitions}
        onChanged={() => void reloadAll()}
      />
    </main>
  );
}
