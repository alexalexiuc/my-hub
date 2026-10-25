'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/utils';
import { DisclosureToggle } from '@/components';
import type { CalorieProfile } from '@my-hub/shared/types';
import type { MeasurementWithType } from '@my-hub/shared/services';
import { ProfileCard } from '../ProfileCard';
import { AutomationApiSection } from '../AutomationApiSection';
import { NOT_SIGNED_IN, PageError, PageLoading } from '../ui';

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
      setError(e instanceof ApiError && e.status === 401 ? NOT_SIGNED_IN : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <PageLoading />;
  if (error) return <PageError error={error} />;

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <ProfileCard profile={profile} latestMeasurements={latestMeasurements} onUpdated={loadData} />
      {/* Developer setup (the key for posting measurements from scripts), kept out of the way of
          the body profile most visits are for. */}
      {profile && (
        <DisclosureToggle label="Advanced: automation API" contentClassName="mt-3">
          <AutomationApiSection userId={profile.userId} initialKey={profile.automationApiKey} />
        </DisclosureToggle>
      )}
    </main>
  );
}
