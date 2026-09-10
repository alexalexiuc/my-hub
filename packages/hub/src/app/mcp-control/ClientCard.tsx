'use client';

import { useState } from 'react';
import { Button, Card, CopyButton, Toggle } from '@/components';
import { apiFetch, cn } from '@/lib/utils';
import type { OAuthClientRow } from './types';

type ClientCardProps = {
  client: OAuthClientRow;
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
};

export function ClientCard({ client, onToggle, onDelete }: ClientCardProps) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleToggle(v: boolean) {
    setToggling(true);
    try {
      await apiFetch(`/api/mcp/clients/${client.id}`, { method: 'PATCH', body: { enabled: v } });
      onToggle(client.id, v);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await apiFetch(`/api/mcp/clients/${client.id}`, { method: 'DELETE' });
      onDelete(client.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const created = new Date(client.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const lastUsed = client.lastUsedAt
    ? new Date(client.lastUsedAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null;

  return (
    <Card compact className={cn('space-y-3', !client.enabled && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{client.clientName ?? 'Unnamed client'}</p>
          <p className="mt-0.5 text-xs text-[var(--subtle,#71717a)]">Created {created}</p>
        </div>
        <Toggle checked={client.enabled} onChange={handleToggle} disabled={toggling} />
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[var(--subtle,#71717a)]">Client ID</span>
          <code className="max-w-[200px] truncate rounded border border-[var(--border,#3f3f46)] bg-[var(--card2,#27272a)] px-1.5 py-0.5 font-mono text-[var(--text,#d4d4d8)]">
            {client.clientId}
          </code>
          <CopyButton value={client.clientId} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[var(--subtle,#71717a)]">Secret</span>
          <span className="italic text-[var(--subtle,#71717a)]">hidden — shown only at creation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[var(--subtle,#71717a)]">Last used</span>
          <span className="text-[var(--text,#d4d4d8)]">{lastUsed ?? 'Never'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[var(--subtle,#71717a)]">Last path</span>
          <code className="max-w-[200px] truncate rounded border border-[var(--border,#3f3f46)] bg-[var(--card2,#27272a)] px-1.5 py-0.5 font-mono text-[var(--text,#d4d4d8)]">
            {client.lastUsedPath ?? '—'}
          </code>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleDelete}
          disabled={deleting}
          onBlur={() => setConfirmDelete(false)}
          className={cn(
            confirmDelete
              ? 'bg-[var(--red-d,rgba(248,113,113,0.1))] text-[var(--red,#f87171)] hover:bg-[var(--red-d,rgba(248,113,113,0.15))] hover:text-[var(--red,#f87171)]'
              : 'hover:text-[var(--red,#f87171)]',
          )}
        >
          {deleting ? 'Revoking…' : confirmDelete ? 'Confirm revoke' : 'Revoke'}
        </Button>
      </div>
    </Card>
  );
}
