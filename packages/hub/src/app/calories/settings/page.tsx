'use client';

import { DisclosureToggle } from '@/components';
import { ProfileCard } from '../ProfileCard';
import { AutomationApiSection } from '../AutomationApiSection';
import { PageError, PageLoading } from '../ui';
import { useCalorieProfile } from '../useCalorieProfile';

export default function SettingsPage() {
  const { profile, measurements, loading, error, reload } = useCalorieProfile();

  if (loading) return <PageLoading />;
  if (error) return <PageError error={error} />;

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <ProfileCard profile={profile} latestMeasurements={measurements} onUpdated={() => reload(true)} />
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
