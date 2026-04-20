'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { Button } from '@/components';
import { apiFetch } from '@/lib/utils';

export function DangerZoneSection() {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAll() {
    setDeleting(true);
    try {
      await apiFetch('/api/user/delete-all', { method: 'POST' });
      setConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SectionCard title="Danger zone">
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Permanently delete all your data (meals, measurements, calorie profile, MCP connections). Your account is
          kept.
        </p>
        {!confirm ? (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Delete all my data…
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-red-800/50 bg-red-950/30 p-4">
            <p className="text-sm font-medium text-red-400">
              This will permanently wipe all your data. Your account will remain. Are you sure?
            </p>
            <div className="flex gap-2">
              <Button variant="danger" loading={deleting} onClick={deleteAll}>
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
