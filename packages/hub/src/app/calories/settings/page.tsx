'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import Link from 'next/link';
import type { CalorieProfile } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { ProfileCard } from '../ProfileCard';
import { AutomationApiSection } from '../AutomationApiSection';

export default function SettingsPage() {
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetch<{ profile: CalorieProfile | null; measurements: MeasurementWithType[] }>(
        '/api/calories/profile',
      );
      setProfile(data.profile);
      setLatestMeasurements(data.measurements);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 py-6">
        <div className="text-[var(--muted)]">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 py-6">
        <p className="text-[var(--red)]">{error}</p>
        {error === 'Not signed in' && (
          <Link href="/auth/signin" className="mt-2 inline-block text-[var(--accent)] underline">
            Sign in
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <ProfileCard profile={profile} latestMeasurements={latestMeasurements} onUpdated={loadData} />
      {profile && <AutomationApiSection userId={profile.userId} initialKey={profile.automationApiKey} />}
    </main>
  );
}
