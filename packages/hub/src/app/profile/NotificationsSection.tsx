'use client';

import { useState, useEffect } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { NOTIFICATION_SUBSCRIPTIONS } from '@my-hub/shared/constants';
import type { SubscriptionKey } from '@my-hub/shared/constants';
import { Checkbox } from '@/components';
import { apiFetch } from '@/lib/utils';

interface SubscriptionState {
  key: SubscriptionKey;
  subscribed: boolean;
}

export function NotificationsSection() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ subscriptions: SubscriptionState[] }>('/api/user/notification-preferences')
      .then((data) => setSubscriptions(data.subscriptions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: SubscriptionKey, subscribed: boolean) {
    setSaving(key);
    try {
      await apiFetch('/api/user/notification-preferences', {
        method: 'PUT',
        body: { key, subscribed },
      });
      setSubscriptions((prev) => prev.map((s) => (s.key === key ? { ...s, subscribed } : s)));
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  // Group subscriptions by section using the config order
  const sections = Array.from(new Map(NOTIFICATION_SUBSCRIPTIONS.map((s) => [s.section, s.section])).keys());

  return (
    <SectionCard title="Notifications">
      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const items = NOTIFICATION_SUBSCRIPTIONS.filter((s) => s.section === section);
            return (
              <div key={section}>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{section}</p>
                <div className="space-y-2">
                  {items.map(({ key, label }) => {
                    const state = subscriptions.find((s) => s.key === key);
                    const isSubscribed = state?.subscribed ?? true;
                    const isSaving = saving === key;
                    return (
                      <label
                        key={key}
                        className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 cursor-pointer hover:border-zinc-600 transition"
                      >
                        <span className="text-sm">{label}</span>
                        <Checkbox
                          checked={isSubscribed}
                          disabled={isSaving}
                          onChange={(e) => toggle(key, e.target.checked)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-zinc-500">You receive reports by default. Uncheck to opt out.</p>
        </div>
      )}
    </SectionCard>
  );
}
