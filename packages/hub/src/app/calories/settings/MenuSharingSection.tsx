'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, Input, Button } from '@/components';

interface MenuShareEntry {
  id: number;
  name: string | null;
  email: string;
}

export function MenuSharingSection() {
  const [shares, setShares] = useState<MenuShareEntry[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<MenuShareEntry[]>([]);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const loadShares = useCallback(async () => {
    try {
      const data = await apiFetch<{ shares: MenuShareEntry[]; sharedWithMe: MenuShareEntry[] }>(
        '/api/calories/menu/shares',
      );
      setShares(data.shares);
      setSharedWithMe(data.sharedWithMe);
    } catch {}
  }, []);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  async function handleShare() {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/calories/menu/shares', { method: 'POST', body: { email: email.trim() } });
      setEmail('');
      await loadShares();
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(shareId: number) {
    try {
      await apiFetch(`/api/calories/menu/shares/${shareId}`, { method: 'DELETE' });
      await loadShares();
    } catch {}
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Menu Sharing</h2>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm text-[var(--muted)]">
          Share your weekly menu so an assistant helping someone else plan their week can see your plan and calorie
          targets, and align meals with yours.
        </p>

        <div className="flex flex-col gap-2">
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Share with email"
            className="w-full text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleShare();
              }
            }}
          />
          <Button onClick={() => void handleShare()} disabled={!email.trim()} loading={saving} size="sm">
            Share
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Shared with</p>
          {shares.length === 0 && <p className="text-xs text-[var(--muted)]">Not shared with anyone yet.</p>}
          {shares.map(share => (
            <div
              key={share.id}
              className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--text)]">{share.name ?? share.email}</span>
              <Button variant="secondary" size="xs" onClick={() => void handleRevoke(share.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Shared with you</p>
          {sharedWithMe.length === 0 && <p className="text-xs text-[var(--muted)]">No one has shared with you yet.</p>}
          {sharedWithMe.map(share => (
            <div
              key={share.id}
              className="flex items-center justify-between rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--text)]">{share.name ?? share.email}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
