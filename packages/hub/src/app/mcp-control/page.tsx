'use client';

import { useEffect, useState, useCallback } from 'react';
import PageHeader from '@/components/page-header';

// ─── Types ───────────────────────────────────────────────────────────────────

interface McpServerRow {
  id: number;
  serverName: 'calories' | 'hive' | 'products';
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
}

interface CreatedClient extends OAuthClientRow {
  plainClientSecret: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MCP_BASE_URL = process.env['NEXT_PUBLIC_MCP_URL'] ?? 'https://mcp.alexiuc.dev';

const SERVER_META: Record<string, { label: string; path: string; description: string }> = {
  calories: {
    label: 'Calories',
    path: '/calories/mcp',
    description: 'Meal logging, body measurements, nutritional summaries',
  },
  hive: {
    label: 'Hive Manager',
    path: '/hive/mcp',
    description: 'Beekeeping logs, hive profiles, inspection history',
  },
  products: {
    label: 'Products',
    path: '/products/mcp',
    description: 'Home inventory, shopping lists, product catalog',
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
          <code className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs border border-zinc-700 text-zinc-300">{MCP_BASE_URL}</code>
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
          <span className="w-24 text-zinc-500 shrink-0">MCP URL</span>
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono border border-zinc-700 text-zinc-300">
            {MCP_BASE_URL}
          </code>
          <CopyButton value={MCP_BASE_URL} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 text-zinc-500 shrink-0">Secret</span>
          <span className="text-zinc-500 italic">hidden — shown only at creation</span>
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

  async function handleToggle(v: boolean) {
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
      className={`rounded-xl border bg-zinc-900 p-4 space-y-2 transition ${server.enabled ? 'border-zinc-800' : 'border-zinc-800 opacity-60'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{meta?.label ?? server.serverName}</p>
        <Toggle checked={server.enabled} onChange={handleToggle} disabled={toggling} />
      </div>
      <p className="text-xs text-zinc-400">{meta?.description}</p>
      <div className="flex items-center gap-1 pt-0.5">
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-mono border border-zinc-700 text-zinc-300 truncate">
          {url}
        </code>
        <CopyButton value={url} />
      </div>
    </div>
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
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      <PageHeader title="MCP Services" backHref="/" backLabel="Dashboard" />

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {servers.map((s) => (
              <ServerCard key={s.id} server={s} onToggle={handleServerToggle} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
