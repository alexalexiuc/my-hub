'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VacationConfig } from '@my-hub/shared/services';
import { PageHeader } from '@/components';
import { apiFetch } from '@/lib/utils';
import { ProfileForm } from './ProfileForm';
import { SetupSummary } from './SetupSummary';

export default function VacationProfilePage() {
  const [config, setConfig] = useState<VacationConfig | null>(null);

  const load = useCallback(async () => {
    try {
      setConfig(await apiFetch<VacationConfig>('/api/vacation/config'));
    } catch {
      // apiFetch already surfaced the error as a toast.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Profile" />
      {config && (
        <>
          {/* Keyed so a first save re-mounts the form with the stored values. */}
          <ProfileForm key={config.profile?.updatedAt?.toString() ?? 'new'} profile={config.profile} onSaved={load} />
          <SetupSummary config={config} />
        </>
      )}
    </main>
  );
}
