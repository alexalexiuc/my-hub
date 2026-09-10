'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components';
import { apiFetch } from '@/lib/utils';
import { ClientCard } from './ClientCard';
import { NewClientForm } from './NewClientForm';
import { SecretRevealCard } from './SecretRevealCard';
import type { CreatedClient, OAuthClientRow } from './types';

export function ConnectionsSection() {
  const [clients, setClients] = useState<OAuthClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newClient, setNewClient] = useState<CreatedClient | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClients(await apiFetch<OAuthClientRow[]>('/api/mcp/clients'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleToggle(id: number, enabled: boolean) {
    setClients(prev => prev.map(c => (c.id === id ? { ...c, enabled } : c)));
  }

  function handleDelete(id: number) {
    setClients(prev => prev.filter(c => c.id !== id));
  }

  function handleCreated(created: CreatedClient) {
    setShowForm(false);
    setNewClient(created);
    setClients(prev => [...prev, created]);
  }

  function dismissSecret() {
    setNewClient(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Connections</h2>
          <p className="mt-0.5 text-sm text-[var(--muted,#a1a1aa)]">
            OAuth credentials for MCP clients (e.g. Claude Desktop).
          </p>
        </div>
        {!showForm && !newClient && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> New connection
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--subtle,#71717a)]">Loading…</p>
      ) : (
        <div className="space-y-3">
          {newClient && <SecretRevealCard client={newClient} onDone={dismissSecret} />}
          {showForm && !newClient && <NewClientForm onCreated={handleCreated} />}
          {clients.length === 0 && !showForm && !newClient && (
            <p className="rounded-xl border border-dashed border-[var(--border,#3f3f46)] p-6 text-center text-sm text-[var(--subtle,#71717a)]">
              No connections yet. Add one to start using MCP clients.
            </p>
          )}
          {clients
            .filter(c => !newClient || c.id !== newClient.id)
            .map(c => (
              <ClientCard key={c.id} client={c} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
        </div>
      )}
    </section>
  );
}
