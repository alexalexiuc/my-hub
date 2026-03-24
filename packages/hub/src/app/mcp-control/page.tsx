'use client';

import { useEffect, useState, useCallback } from 'react';
import PageHeader from '@/components/page-header';
import { McpServerName } from '@my-hub/shared/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

interface McpServerRow {
  id: number;
  serverName: McpServerName;
  enabled: boolean;
  createdAt: string;
}

interface OAuthClientRow {
  id: number;
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  enabled: boolean;
  userId: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  lastUsedPath?: string | null;
}

interface CreatedClient extends OAuthClientRow {
  plainClientSecret: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MCP_BASE_URL = process.env['NEXT_PUBLIC_MCP_URL'] ?? 'https://mcp.alexiuc.dev';

const SERVER_META: Record<string, { label: string; path: string; description: string; active: boolean }> = {
  calories: {
    label: 'Calories',
    path: '/api/calories/mcp',
    description: 'Meal logging, body measurements, nutritional summaries',
    active: true,
  },
  products: {
    label: 'Products',
    path: '/api/products/mcp',
    description: 'Home inventory, shopping lists, product catalog',
    active: false,
  },
  todo: {
    label: 'Todo',
    path: '/api/todo/mcp',
    description: 'Task management, reminders, to-do lists',
    active: true,
  },
  apiary: {
    label: 'Apiary',
    path: '/api/apiary/mcp',
    description: 'Apiary management, hive tracking, beekeeping analytics',
    active: true,
  },
  travel: {
    label: 'Travel',
    path: '/api/travel/mcp',
    description: 'Trip planning, itinerary management, travel document storage',
    active: true,
  },
};

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="ml-1 rounded px-1.5 py-0.5 text-xs font-medium text-indigo-400 hover:bg-indigo-950/30 transition"
    >
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

// ─── Secret Reveal Card ───────────────────────────────────────────────────────

function SecretRevealCard({ client, onDone }: { client: CreatedClient; onDone: () => void }) {
  return (
    <div className="rounded-xl border-2 border-amber-700/50 bg-amber-950/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-xl leading-none">⚠</span>
        <div>
          <p className="font-semibold text-amber-300">Save these credentials now</p>
          <p className="text-sm text-amber-400 mt-0.5">
            The client secret is shown only once and cannot be retrieved after you close this.
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-32 text-zinc-400 shrink-0">Client name</span>
          <span className="font-medium">{client.clientName ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 text-zinc-400 shrink-0">Client ID</span>
          <code className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs border border-zinc-700 text-zinc-300">
            {client.clientId}
          </code>
          <CopyButton value={client.clientId} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 text-zinc-400 shrink-0">Client secret</span>
          <code className="rounded bg-amber-950/20 px-2 py-0.5 font-mono text-xs border border-amber-700/50 text-amber-300">
            {client.plainClientSecret}
          </code>
          <CopyButton value={client.plainClientSecret} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 text-zinc-400 shrink-0">MCP URL</span>
          <code className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs border border-zinc-700 text-zinc-300">
            {MCP_BASE_URL}
          </code>
          <CopyButton value={MCP_BASE_URL} />
        </div>
      </div>

      <button
        onClick={onDone}
        className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 transition"
      >
        I've saved the credentials — done
      </button>
    </div>
  );
}

// ─── New Client Form ──────────────────────────────────────────────────────────

function NewClientForm({ onCreated }: { onCreated: (c: CreatedClient) => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/mcp/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      const data = (await res.json()) as CreatedClient & { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to create client');
        return;
      }
      onCreated(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-4"
    >
      <div className="flex-1">
        <label className="text-xs text-zinc-400 block mb-1">Connection name</label>
        <input
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Claude Desktop"
          autoFocus
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition whitespace-nowrap"
      >
        {loading ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}

// ─── OAuth Client Card ────────────────────────────────────────────────────────

function ClientCard({
  client,
  onToggle,
  onDelete,
}: {
  client: OAuthClientRow;
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleToggle(v: boolean) {
    setToggling(true);
    try {
      await fetch(`/api/mcp/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: v }),
      });
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
      await fetch(`/api/mcp/clients/${client.id}`, { method: 'DELETE' });
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
    <div
      className={`rounded-xl border bg-zinc-900 p-4 space-y-3 transition ${client.enabled ? 'border-zinc-800' : 'border-zinc-800 opacity-60'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{client.clientName ?? 'Unnamed client'}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Created {created}</p>
        </div>
        <Toggle checked={client.enabled} onChange={handleToggle} disabled={toggling} />
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-24 text-zinc-500 shrink-0">Client ID</span>
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono border border-zinc-700 text-zinc-300 truncate max-w-[200px]">
            {client.clientId}
          </code>
          <CopyButton value={client.clientId} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 text-zinc-500 shrink-0">Secret</span>
          <span className="text-zinc-500 italic">hidden — shown only at creation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 text-zinc-500 shrink-0">Last used</span>
          <span className="text-zinc-300">{lastUsed ?? 'Never'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 text-zinc-500 shrink-0">Last path</span>
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono border border-zinc-700 text-zinc-300 truncate max-w-[200px]">
            {client.lastUsedPath ?? '—'}
          </code>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`text-xs font-medium transition px-2 py-1 rounded ${
            confirmDelete
              ? 'bg-red-950/30 text-red-400 hover:bg-red-900/40'
              : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
          } disabled:opacity-50`}
          onBlur={() => setConfirmDelete(false)}
        >
          {deleting ? 'Revoking…' : confirmDelete ? 'Confirm revoke' : 'Revoke'}
        </button>
      </div>
    </div>
  );
}

// ─── MCP Server Card ──────────────────────────────────────────────────────────

function ServerCard({
  server,
  onToggle,
}: {
  server: McpServerRow;
  onToggle: (name: string, enabled: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const meta = SERVER_META[server.serverName];
  const url = `${MCP_BASE_URL}${meta?.path ?? ''}`;
  const isActive = meta?.active !== false;

  async function handleToggle(v: boolean) {
    if (!isActive) return;
    setToggling(true);
    try {
      await fetch(`/api/mcp/servers/${server.serverName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: v }),
      });
      onToggle(server.serverName, v);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className={`rounded-xl border bg-zinc-900 p-5 space-y-3 transition ${
        !isActive ? 'border-zinc-800 opacity-40' : server.enabled ? 'border-zinc-800' : 'border-zinc-800 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-base">{meta?.label ?? server.serverName}</p>
          {!isActive && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Coming soon</span>
          )}
        </div>
        <Toggle checked={isActive && server.enabled} onChange={handleToggle} disabled={toggling || !isActive} />
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{meta?.description}</p>
      <div className="flex items-center gap-2 pt-1">
        <code className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-mono border border-zinc-700 text-zinc-300 break-all">
          {url}
        </code>
        {isActive && <CopyButton value={url} />}
      </div>
    </div>
  );
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  service: string;
  server: string | null;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  error: string | null;
}

const SERVER_OPTIONS: { value: McpServerName | ''; label: string }[] = [
  { value: '', label: 'All servers' },
  { value: 'calories', label: 'Calories' },
  { value: 'todo', label: 'Todo' },
  { value: 'products', label: 'Products' },
  { value: 'apiary', label: 'Apiary' },
];

function StatusBadge({ code }: { code: number | null }) {
  if (code === null) return <span className="text-zinc-500">—</span>;
  const color =
    code < 300
      ? 'text-green-400 bg-green-950/40'
      : code < 400
        ? 'text-yellow-400 bg-yellow-950/40'
        : 'text-red-400 bg-red-950/40';
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-mono font-medium ${color}`}>{code}</span>;
}

function MethodBadge({ method }: { method: string }) {
  const color: Record<string, string> = {
    GET: 'text-blue-400',
    POST: 'text-green-400',
    PUT: 'text-amber-400',
    PATCH: 'text-amber-400',
    DELETE: 'text-red-400',
  };
  return <span className={`text-xs font-mono font-semibold ${color[method] ?? 'text-zinc-400'}`}>{method}</span>;
}

function AuditLogSection() {
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
      const params = new URLSearchParams();
      if (server) params.set('server', server);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      params.set('limit', String(limit));

      const res = await fetch(`/api/mcp/logs?${params}`);
      if (res.ok) {
        const data = (await res.json()) as { logs: LogEntry[] };
        setLogs(data.logs);
      }
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
        <p className="text-sm text-zinc-400 mt-0.5">Review API requests made through MCP servers.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Server</label>
          <select className="input text-sm" value={server} onChange={(e) => setServer(e.target.value)}>
            {SERVER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">From</label>
          <input type="date" className="input text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">To</label>
          <input type="date" className="input text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Limit</label>
          <select className="input text-sm" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {loading ? 'Loading…' : loaded ? 'Refresh' : 'Load logs'}
        </button>
      </div>

      {/* Results */}
      {loaded && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {logs.length === 0 ? (
            <p className="text-sm text-zinc-500 p-6 text-center">No logs found for the selected filters.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {/* Header */}
              <div className="grid grid-cols-[5rem_3.5rem_1fr_4rem_4.5rem_8rem] gap-2 px-4 py-2 text-xs font-semibold text-zinc-500 bg-zinc-900/50">
                <span>Server</span>
                <span>Method</span>
                <span>Path</span>
                <span>Status</span>
                <span className="text-right">Duration</span>
                <span className="text-right">Time</span>
              </div>
              {logs.map((log) => (
                <div key={log.id}>
                  <div
                    className="grid grid-cols-[5rem_3.5rem_1fr_4rem_4.5rem_8rem] gap-2 px-4 py-2.5 text-sm hover:bg-zinc-800/50 cursor-pointer transition"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <span className="text-xs text-zinc-400 truncate">{log.server ?? log.service}</span>
                    <MethodBadge method={log.method} />
                    <span className="text-zinc-300 font-mono text-xs truncate" title={log.path}>
                      {log.path}
                    </span>
                    <StatusBadge code={log.statusCode} />
                    <span className="text-xs text-zinc-500 text-right tabular-nums">
                      {log.durationMs !== null ? `${log.durationMs}ms` : '—'}
                    </span>
                    <span className="text-xs text-zinc-500 text-right">{formatTime(log.createdAt)}</span>
                  </div>
                  {expandedId === log.id && (
                    <div className="px-4 pb-3 space-y-2 bg-zinc-900/30">
                      {log.error && (
                        <div>
                          <span className="text-xs font-semibold text-red-400">Error</span>
                          <pre className="mt-1 text-xs text-red-300 bg-red-950/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                            {log.error}
                          </pre>
                        </div>
                      )}
                      {log.requestBody && (
                        <div>
                          <span className="text-xs font-semibold text-zinc-400">Request body</span>
                          <pre className="mt-1 text-xs text-zinc-300 bg-zinc-800 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                            {JSON.stringify(log.requestBody, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.responseBody && (
                        <div>
                          <span className="text-xs font-semibold text-zinc-400">Response body</span>
                          <pre className="mt-1 text-xs text-zinc-300 bg-zinc-800 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                            {JSON.stringify(log.responseBody, null, 2)}
                          </pre>
                        </div>
                      )}
                      {!log.error && !log.requestBody && !log.responseBody && (
                        <p className="text-xs text-zinc-500">No additional details available.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function McpControlPage() {
  const [servers, setServers] = useState<McpServerRow[]>([]);
  const [clients, setClients] = useState<OAuthClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newClient, setNewClient] = useState<CreatedClient | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([fetch('/api/mcp/servers'), fetch('/api/mcp/clients')]);
      const [sData, cData] = (await Promise.all([sRes.json(), cRes.json()])) as [McpServerRow[], OAuthClientRow[]];
      setServers(sData);
      setClients(cData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleServerToggle(name: string, enabled: boolean) {
    setServers((prev) => prev.map((s) => (s.serverName === name ? { ...s, enabled } : s)));
  }

  function handleClientToggle(id: number, enabled: boolean) {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
  }

  function handleClientDelete(id: number) {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCreated(created: CreatedClient) {
    setShowForm(false);
    setNewClient(created);
    setClients((prev) => [...prev, created]);
  }

  function dismissSecret() {
    setNewClient(null);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-10">
      <PageHeader title="MCP Service" backHref="/" backLabel="← Home" />

      {/* OAuth Clients */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Connections</h2>
            <p className="text-sm text-zinc-400 mt-0.5">OAuth credentials for MCP clients (e.g. Claude Desktop).</p>
          </div>
          {!showForm && !newClient && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition shadow-sm"
            >
              <span className="text-lg leading-none">+</span> New connection
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="space-y-3">
            {newClient && <SecretRevealCard client={newClient} onDone={dismissSecret} />}
            {showForm && !newClient && <NewClientForm onCreated={handleCreated} />}
            {clients.length === 0 && !showForm && !newClient && (
              <p className="text-sm text-zinc-500 rounded-xl border border-dashed border-zinc-700 p-6 text-center">
                No connections yet. Add one to start using MCP clients.
              </p>
            )}
            {clients
              .filter((c) => !newClient || c.id !== newClient.id)
              .map((c) => (
                <ClientCard key={c.id} client={c} onToggle={handleClientToggle} onDelete={handleClientDelete} />
              ))}
          </div>
        )}
      </section>

      {/* MCP Servers */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">MCP Servers</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Enable or disable individual MCP sub-servers.</p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servers.map((s) => (
              <ServerCard key={s.id} server={s} onToggle={handleServerToggle} />
            ))}
          </div>
        )}
      </section>

      {/* Audit Log */}
      <AuditLogSection />
    </main>
  );
}
