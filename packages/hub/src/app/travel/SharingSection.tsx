'use client';

import { useState } from 'react';
import { Button } from '@/components';
import { Card } from '@/components';
import { TravelSectionHeader } from './ui';
import type { ApiTrip, TripShareView } from './types';
import { apiFetch } from '@/lib/utils';
import { ShareModal } from './ShareModal';
import { travelEvents } from './travelEvents';

type SharingSectionProps = {
  activeTrip: ApiTrip | null;
  canEdit: boolean;
};

export function SharingSection({ activeTrip, canEdit }: SharingSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [shares, setShares] = useState<TripShareView[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadShares() {
    if (!activeTrip) return;
    try {
      const data = await apiFetch<{ shares: TripShareView[] }>(`/api/travel/trips/${activeTrip.id}/shares`);
      setShares(data.shares);
      setLoaded(true);
    } catch {}
  }

  // Lazy-load shares when section mounts with a valid trip
  if (!loaded && activeTrip && canEdit) {
    loadShares();
  }

  async function revokeShare(shareId: number) {
    if (!activeTrip) return;
    await apiFetch(`/api/travel/trips/${activeTrip.id}/shares/${shareId}`, { method: 'DELETE' });
    travelEvents.emit('changed');
    loadShares();
  }

  const headerAction =
    canEdit && activeTrip ? (
      <Button size="xs" variant="accent" onClick={() => setShowModal(true)}>
        Share
      </Button>
    ) : null;

  return (
    <>
      {showModal && activeTrip && (
        <ShareModal
          activeTrip={activeTrip}
          onClose={() => {
            setShowModal(false);
            loadShares();
          }}
        />
      )}

      <Card className="!p-0 overflow-hidden">
        <TravelSectionHeader title="Sharing" action={headerAction} />
        <div className="p-4">
          {!activeTrip && <p className="text-sm text-[var(--muted)]">Select a trip to manage sharing.</p>}
          {activeTrip && !canEdit && (
            <p className="text-sm text-[var(--muted)]">Only the trip owner can manage sharing.</p>
          )}
          {activeTrip && canEdit && (
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Shared with</p>
              {shares.length === 0 && <p className="text-xs text-[var(--muted)]">Not shared with anyone yet.</p>}
              {shares.map(share => (
                <div
                  key={share.id}
                  className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-xs"
                >
                  <span className="text-[var(--text)]">{share.name ?? share.email}</span>
                  <Button variant="secondary" size="xs" onClick={() => revokeShare(share.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
