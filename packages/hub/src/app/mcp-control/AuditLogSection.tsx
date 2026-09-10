'use client';

import { useState } from 'react';
import { Input, Select, Button, Card } from '@/components';
import { apiFetch } from '@/lib/utils';
import { SERVER_OPTIONS } from './constants';
import type { LogEntry } from './types';

function StatusBadge({ code }: { code: number | null }) {
  if (code === null) return <span className="text-[var(--subtle,#71717a)]">—</span>;
  const color =
    code < 300
      ? 'text-[var(--green,#6ee7b7)] bg-[var(--green-d,rgba(110,231,183,0.1))]'
      : code < 400
        ? 'text-[var(--amber,#fcd34d)] bg-[var(--amber-d,rgba(252,211,77,0.1))]'
        : 'text-[var(--red,#f87171)] bg-[var(--red-d,rgba(248,113,113,0.1))]';
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-mono font-medium ${color}`}>{code}</span>;
}

function MethodBadge({ method }: { method: string }) {
  const color: Record<string, string> = {
    GET: 'text-[var(--blue,#93c5fd)]',
    POST: 'text-[var(--green,#6ee7b7)]',
    PUT: 'text-[var(--amber,#fcd34d)]',
    PATCH: 'text-[var(--amber,#fcd34d)]',
    DELETE: 'text-[var(--red,#f87171)]',
  };
  return (
    <span className={`text-xs font-mono font-semibold ${color[method] ?? 'text-[var(--muted,#a1a1aa)]'}`}>
      {method}
    </span>
  );
}

export function AuditLogSection() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(50);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await apiFetch<{ logs: LogEntry[] }>('/api/mcp/logs', {
        query: { server: server || undefined, from: dateFrom || undefined, to: dateTo || undefined, limit },
      });
      setLogs(data.logs);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <p className="mt-0.5 text-sm text-[var(--muted,#a1a1aa)]">Review API requests made through MCP servers.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--subtle,#71717a)]">Server</label>
          <Select
            className="text-sm"
            options={SERVER_OPTIONS}
            value={server}
            onChange={e => setServer(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--subtle,#71717a)]">From</label>
          <Input type="date" className="text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--subtle,#71717a)]">To</label>
          <Input type="date" className="text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--subtle,#71717a)]">Limit</label>
          <Select
            className="text-sm"
            options={[25, 50, 100, 200].map(n => ({ value: n, label: String(n) }))}
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
          />
        </div>
        <Button onClick={loadLogs} disabled={loading}>
          {loading ? 'Loading…' : loaded ? 'Refresh' : 'Load logs'}
        </Button>
      </div>

      {/* Results */}
      {loaded && (
        <Card compact className="overflow-hidden !p-0">
          {logs.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--subtle,#71717a)]">
              No logs found for the selected filters.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border,#3f3f46)]">
              {/* Header */}
              <div className="grid grid-cols-[5rem_3.5rem_1fr_4rem_4.5rem_8rem] gap-2 bg-[var(--card2,#27272a)]/50 px-4 py-2 text-xs font-semibold text-[var(--subtle,#71717a)]">
                <span>Server</span>
                <span>Method</span>
                <span>Path</span>
                <span>Status</span>
                <span className="text-right">Duration</span>
                <span className="text-right">Time</span>
              </div>
              {logs.map(log => (
                <div key={log.id}>
                  <div
                    className="grid cursor-pointer grid-cols-[5rem_3.5rem_1fr_4rem_4.5rem_8rem] gap-2 px-4 py-2.5 text-sm transition hover:bg-[var(--card2,#27272a)]/50"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <span className="truncate text-xs text-[var(--muted,#a1a1aa)]">{log.server ?? log.service}</span>
                    <MethodBadge method={log.method} />
                    <span className="truncate font-mono text-xs text-[var(--text,#d4d4d8)]" title={log.path}>
                      {log.path}
                    </span>
                    <StatusBadge code={log.statusCode} />
                    <span className="text-right text-xs tabular-nums text-[var(--subtle,#71717a)]">
                      {log.durationMs !== null ? `${log.durationMs}ms` : '—'}
                    </span>
                    <span className="text-right text-xs text-[var(--subtle,#71717a)]">{formatTime(log.createdAt)}</span>
                  </div>
                  {expandedId === log.id && (
                    <div className="space-y-2 bg-[var(--card2,#27272a)]/30 px-4 pb-3">
                      {log.error && (
                        <div>
                          <span className="text-xs font-semibold text-[var(--red,#f87171)]">Error</span>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--red-d,rgba(248,113,113,0.08))] p-3 text-xs text-[var(--red,#f87171)]">
                            {log.error}
                          </pre>
                        </div>
                      )}
                      {log.requestBody && (
                        <div>
                          <span className="text-xs font-semibold text-[var(--muted,#a1a1aa)]">Request body</span>
                          <pre className="mt-1 max-h-48 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--card2,#27272a)] p-3 text-xs text-[var(--text,#d4d4d8)]">
                            {JSON.stringify(log.requestBody, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.responseBody && (
                        <div>
                          <span className="text-xs font-semibold text-[var(--muted,#a1a1aa)]">Response body</span>
                          <pre className="mt-1 max-h-48 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--card2,#27272a)] p-3 text-xs text-[var(--text,#d4d4d8)]">
                            {JSON.stringify(log.responseBody, null, 2)}
                          </pre>
                        </div>
                      )}
                      {!log.error && !log.requestBody && !log.responseBody && (
                        <p className="text-xs text-[var(--subtle,#71717a)]">No additional details available.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
