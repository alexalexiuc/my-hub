'use client';

import { useState } from 'react';
import { Card, CopyButton, Toggle } from '@/components';
import { apiFetch, cn } from '@/lib/utils';
import { MCP_BASE_URL, SERVER_META } from './constants';
import type { McpServerRow } from './types';

type ServerCardProps = {
  server: McpServerRow;
  onToggle: (name: string, enabled: boolean) => void;
};

export function ServerCard({ server, onToggle }: ServerCardProps) {
  const [toggling, setToggling] = useState(false);
  const meta = SERVER_META[server.serverName];
  const url = `${MCP_BASE_URL}${meta?.path ?? ''}`;
  const isActive = meta?.active !== false;

  async function handleToggle(v: boolean) {
    if (!isActive) return;
    setToggling(true);
    try {
      await apiFetch(`/api/mcp/servers/${server.serverName}`, { method: 'PATCH', body: { enabled: v } });
      onToggle(server.serverName, v);
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card compact className={cn('space-y-3', !isActive ? 'opacity-40' : !server.enabled && 'opacity-60')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">{meta?.label ?? server.serverName}</p>
          {!isActive && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--subtle,#71717a)]">
              Coming soon
            </span>
          )}
        </div>
        <Toggle checked={isActive && server.enabled} onChange={handleToggle} disabled={toggling || !isActive} />
      </div>
      <p className="text-sm leading-relaxed text-[var(--muted,#a1a1aa)]">{meta?.description}</p>
      <div className="flex items-center gap-2 pt-1">
        <code className="break-all rounded-md border border-[var(--border,#3f3f46)] bg-[var(--card2,#27272a)] px-2.5 py-1 font-mono text-xs text-[var(--text,#d4d4d8)]">
          {url}
        </code>
        {isActive && <CopyButton value={url} />}
      </div>
    </Card>
  );
}
