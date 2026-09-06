'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { apiFetch } from '@/lib/utils';
import { AccountSection } from './AccountSection';
import { DataDeletionSection } from './DataDeletionSection';
import { DangerZoneSection } from './DangerZoneSection';
import { AppearanceSection } from './AppearanceSection';
import { NotificationsSection } from './NotificationsSection';
import { PersonalInfoSection } from './PersonalInfoSection';
import { ProfilePageSkeleton } from './ProfilePageSkeleton';
import { SessionSection } from './SessionSection';
import type { UserProfile } from './types';

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UserProfile>('/api/user/profile')
      .then(data => setUser(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <ProfilePageSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <PageHeader title="Profile" backHref="/" backLabel="← Home" />
      {user && <AccountSection user={user} />}
      <PersonalInfoSection />
      <DataDeletionSection />
      <AppearanceSection />
      <NotificationsSection />
      <DangerZoneSection />
      {user && <SessionSection email={user.email} />}
    </main>
  );
}
