'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components';
import { SectionCard } from '@/components/SectionCard';
import type { ApiTrip, TripShareSuggestion, TripShareView } from './types';
import { apiFetch } from '@/lib/utils';

type SharingSectionProps = {
  activeTrip: ApiTrip | null;
  canEdit: boolean;
};

export function SharingSection({ activeTrip, canEdit }: SharingSectionProps) {
  const [tripShares, setTripShares] = useState<TripShareView[]>([]);
  const [shareSuggestions, setShareSuggestions] = useState<TripShareSuggestion[]>([]);
  const [shareEmail, setShareEmail] = useState('');

  const loadShares = useCallback(async (tripId: number) => {
    try {
      const data = await apiFetch<{ shares: TripShareView[]; suggestions: TripShareSuggestion[] }>(
        `/api/travel/trips/${tripId}/shares`,
      );
      setTripShares(data.shares);
      setShareSuggestions(data.suggestions);
    } catch {
      setTripShares([]);
      setShareSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (!activeTrip || !canEdit) {
      setTripShares([]);
      setShareSuggestions([]);
      return;
    }
    loadShares(activeTrip.id);
  }, [activeTrip?.id, canEdit, loadShares]);

  async function shareTripByEmail() {
    if (!activeTrip || !canEdit || !shareEmail.trim()) return;
    try {
      await apiFetch(`/api/travel/trips/${activeTrip.id}/shares`, {
        method: 'POST',
        body: { email: shareEmail.trim() },
      });
      setShareEmail('');
      await loadShares(activeTrip.id);
    } catch {
      // ignore
    }
  }

  async function shareTripWithUser(userId: string) {
    if (!activeTrip || !canEdit) return;
    try {
      await apiFetch(`/api/travel/trips/${activeTrip.id}/shares`, {
        method: 'POST',
        body: { user_id: userId },
      });
      await loadShares(activeTrip.id);
    } catch {
      // ignore
    }
  }

  async function revokeTripShare(shareId: number) {
    if (!activeTrip || !canEdit) return;
    try {
      await apiFetch(`/api/travel/trips/${activeTrip.id}/shares/${shareId}`, { method: 'DELETE' });
      await loadShares(activeTrip.id);
    } catch {
      // ignore
    }
  }

  return (
    <SectionCard title="Sharing" className="bg-violet-950/20 border-violet-800/50">
      {!activeTrip && <p className="text-sm text-zinc-500">Select a trip to manage sharing.</p>}
      {activeTrip && !canEdit && (
        <p className="text-sm text-zinc-500">
          Only the trip owner can manage sharing. You currently have view-only access.
        </p>
      )}
      {activeTrip && canEdit && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="Share with user email"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <Button onClick={shareTripByEmail} className="bg-violet-600 hover:bg-violet-500">
              Share
            </Button>
          </div>

          {shareSuggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Suggestions from companions in Hub</p>
              <div className="space-y-1">
                {shareSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.user_id}
                    className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                  >
                    <span className="text-zinc-300">{suggestion.name ?? suggestion.email}</span>
                    <Button
                      size="xs"
                      onClick={() => shareTripWithUser(suggestion.user_id)}
                      className="bg-violet-600 hover:bg-violet-500"
                    >
                      Share
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Shared with</p>
            {tripShares.length === 0 && <p className="text-sm text-zinc-500">No shared users yet.</p>}
            {tripShares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              >
                <span className="text-zinc-300">{share.name ?? share.email}</span>
                <Button variant="secondary" size="xs" onClick={() => revokeTripShare(share.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
