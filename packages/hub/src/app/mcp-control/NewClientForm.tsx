'use client';

import { useState } from 'react';
import { Input, Button } from '@/components';
import { apiFetch, ApiError } from '@/lib/utils';
import type { CreatedClient } from './types';

type NewClientFormProps = {
  onCreated: (c: CreatedClient) => void;
};

export function NewClientForm({ onCreated }: NewClientFormProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<CreatedClient>('/api/mcp/clients', {
        method: 'POST',
        body: { name: name.trim() || null },
      });
      onCreated(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-3 rounded-xl border border-dashed border-[var(--border,#3f3f46)] bg-[var(--card,#18181b)] p-4"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs text-[var(--muted,#a1a1aa)]">Connection name</label>
        <Input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Claude Desktop"
          autoFocus
        />
      </div>
      {error && <p className="text-xs text-[var(--red,#f87171)]">{error}</p>}
      <Button type="submit" disabled={loading} className="whitespace-nowrap">
        {loading ? 'Creating…' : 'Create'}
      </Button>
    </form>
  );
}
