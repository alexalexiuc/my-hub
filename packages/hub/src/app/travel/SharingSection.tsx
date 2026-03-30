'use client';

import { useCallback, useEffect, useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { ApiTrip, TripShareSuggestion, TripShareView } from './types';

interface SharingSectionProps {
  activeTrip: ApiTrip | null;
  canEdit: boolean;
}

export function SharingSection({ activeTrip, canEdit }: SharingSectionProps) {
  const [tripShares, setTripShares] = useState<TripShareView[]>([]);
  const [shareSuggestions, setShareSuggestions] = useState<TripShareSuggestion[]>([]);
  const [shareEmail, setShareEmail] = useState('');

  const loadShares = useCallback(async (tripId: number) => {
    const res = await fetch(`/api/travel/trips/${tripId}/shares`);
    if (!res.ok) {
      setTripShares([]);
      setShareSuggestions([]);
      return;
    }
    const data = (await res.json()) as { shares: TripShareView[]; suggestions: TripShareSuggestion[] };
    setTripShares(data.shares);
    setShareSuggestions(data.suggestions);
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
    const res = await fetch(`/api/travel/trips/${activeTrip.id}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: shareEmail.trim() }),
    });
    if (!res.ok) return;
    setShareEmail('');
    await loadShares(activeTrip.id);
  }

  async function shareTripWithUser(userId: string) {
    if (!activeTrip || !canEdit) return;
    const res = await fetch(`/api/travel/trips/${activeTrip.id}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) return;
    await loadShares(activeTrip.id);
  }

  async function revokeTripShare(shareId: number) {
    if (!activeTrip || !canEdit) return;
    const res = await fetch(`/api/travel/trips/${activeTrip.id}/shares/${shareId}`, { method: 'DELETE' });
    if (!res.ok) return;
    await loadShares(activeTrip.id);
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
            <button
              onClick={shareTripByEmail}
              className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Share
            </button>
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
                    <button
                      onClick={() => shareTripWithUser(suggestion.user_id)}
                      className="rounded bg-violet-700 px-2 py-1 text-[11px] text-white hover:bg-violet-600"
                    >
                      Share
                    </button>
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
                <button
                  onClick={() => revokeTripShare(share.id)}
                  className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
