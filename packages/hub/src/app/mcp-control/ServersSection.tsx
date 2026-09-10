'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { ServerCard } from './ServerCard';
import type { McpServerRow } from './types';

export function ServersSection() {
  const [servers, setServers] = useState<McpServerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await apiFetch<McpServerRow[]>('/api/mcp/servers'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleToggle(name: string, enabled: boolean) {
    setServers(prev => prev.map(s => (s.serverName === name ? { ...s, enabled } : s)));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">MCP Servers</h2>
        <p className="mt-0.5 text-sm text-[var(--muted,#a1a1aa)]">Enable or disable individual MCP sub-servers.</p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--subtle,#71717a)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {servers.map(s => (
            <ServerCard key={s.id} server={s} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </section>
  );
}
