'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { CalorieProfile, MealLog, MeasurementType } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import ProfileCard from './profile-card';
import MealsSection from './meals-section';
import MeasurementsSection from './measurements-section';

export default function DashboardPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [measurementTypes, setMeasurementTypes] = useState<MeasurementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0]!;

  const loadData = useCallback(async () => {
    try {
      const [profileRes, mealsRes, typesRes] = await Promise.all([
        fetch('/api/calories/profile'),
        fetch(`/api/calories/meals?date=${today}&limit=100`),
        fetch('/api/calories/measurement-types'),
      ]);

      if (profileRes.status === 401 || mealsRes.status === 401) {
        setError('Not signed in');
        return;
      }

      const [profileData, mealsData, typesData] = await Promise.all([
        profileRes.json() as Promise<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>,
        mealsRes.json() as Promise<{ meals: MealLog[] }>,
        typesRes.json() as Promise<{ types: MeasurementType[] }>,
      ]);

      setProfile(profileData.profile);
      setLatestMeasurements(profileData.measurements);
      setMeals(mealsData.meals);
      setMeasurementTypes(typesData.types);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <div className="text-gray-400">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-red-500">{error}</p>
        {error === 'Not signed in' && (
          <Link href="/auth/signin" className="mt-2 inline-block text-blue-600 underline">
            Sign in
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Home
        </Link>
      </div>

      <ProfileCard
        profile={profile}
        latestMeasurements={latestMeasurements}
        onUpdated={loadData}
      />

      <MealsSection
        meals={meals}
        today={today}
        onChanged={loadData}
      />

      <MeasurementsSection
        latestMeasurements={latestMeasurements}
        measurementTypes={measurementTypes}
        onChanged={loadData}
      />
    </main>
  );
}
