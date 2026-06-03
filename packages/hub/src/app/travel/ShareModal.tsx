'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal, Input, Button } from '@/components';
import type { ApiTrip, TripShareSuggestion, TripShareView } from './types';
import { FieldCard } from './ui';
import { apiFetch } from '@/lib/utils';

type ShareModalProps = {
  activeTrip: ApiTrip;
  onClose: () => void;
};

export function ShareModal({ activeTrip, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<TripShareView[]>([]);
  const [suggestions, setSuggestions] = useState<TripShareSuggestion[]>([]);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const loadShares = useCallback(async () => {
    try {
      const data = await apiFetch<{ shares: TripShareView[]; suggestions: TripShareSuggestion[] }>(
        `/api/travel/trips/${activeTrip.id}/shares`,
      );
      setShares(data.shares);
      setSuggestions(data.suggestions);
    } catch {}
  }, [activeTrip.id]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  async function handleShare() {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/travel/trips/${activeTrip.id}/shares`, {
        method: 'POST',
        body: { email: email.trim() },
      });
      setEmail('');
      await loadShares();
    } finally {
      setSaving(false);
    }
  }

  async function handleShareByUser(userId: string) {
    try {
      await apiFetch(`/api/travel/trips/${activeTrip.id}/shares`, { method: 'POST', body: { userId } });
      await loadShares();
    } catch {}
  }

  async function handleRevoke(shareId: number) {
    try {
      await apiFetch(`/api/travel/trips/${activeTrip.id}/shares/${shareId}`, { method: 'DELETE' });
      await loadShares();
    } catch {}
  }

  return (
    <Modal title="Share Trip" onClose={onClose} className="md:max-w-[440px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FieldCard label="Share with email">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              variant="ghost"
              autoFocus
              className="w-full text-[13px]"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleShare();
                }
              }}
            />
          </FieldCard>
          <Button onClick={handleShare} disabled={!email.trim()} loading={saving} variant="accent" className="w-full">
            Share
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Suggestions from companions</p>
            {suggestions.map(s => (
              <div
                key={s.userId}
                className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-xs"
              >
                <span className="text-[var(--text)]">{s.name ?? s.email}</span>
                <Button size="xs" variant="accent" onClick={() => handleShareByUser(s.userId)}>
                  Share
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Shared with</p>
          {shares.length === 0 && <p className="text-xs text-[var(--muted)]">Not shared with anyone yet.</p>}
          {shares.map(share => (
            <div
              key={share.id}
              className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--text)]">{share.name ?? share.email}</span>
              <Button variant="secondary" size="xs" onClick={() => handleRevoke(share.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
