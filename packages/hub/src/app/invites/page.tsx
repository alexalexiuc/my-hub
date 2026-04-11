'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { Button, Select } from '@/components';
import type { InviteTokenWithUsedByEmail } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';

type ExpiryOption = '7' | '30' | 'none';

function inviteStatus(invite: InviteTokenWithUsedByEmail): 'used' | 'expired' | 'pending' {
  if (invite.usedAt) return 'used';
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return 'expired';
  return 'pending';
}

const STATUS_STYLES = {
  pending: 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50',
  used: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  expired: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
};

export default function InvitesPage() {
  const [invites, setInvites] = useState<InviteTokenWithUsedByEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryOption>('7');
  const [newLink, setNewLink] = useState<string | null>(null);
  const [newLinkInviteId, setNewLinkInviteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ invites: InviteTokenWithUsedByEmail[] }>('/api/invites')
      .then((data) => setInvites(data.invites))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function generateInvite() {
    setCreating(true);
    setNewLink(null);
    setNewLinkInviteId(null);
    try {
      const body = expiry !== 'none' ? { expiresInDays: Number(expiry) } : {};
      const data = await apiFetch<{ invite: InviteTokenWithUsedByEmail }>('/api/invites', {
        method: 'POST',
        body,
      });
      setInvites((prev) => [data.invite, ...prev]);
      const link = `${window.location.origin}/auth/register?invite=${data.invite.token}`;
      setNewLink(link);
      setNewLinkInviteId(data.invite.id);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revoke(id: string) {
    setRevoking(id);
    try {
      await apiFetch(`/api/invites/${id}`, { method: 'DELETE' });
      setInvites((prev) => prev.filter((i) => i.id !== id));
      if (newLinkInviteId === id) {
        setNewLink(null);
        setNewLinkInviteId(null);
      }
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="text-zinc-400">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <PageHeader title="Invite Links" backHref="/" backLabel="← Home" />

      <SectionCard title="Generate invite">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Generate a single-use link and share it with a friend. The link expires after use.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">Expires in</span>
            <Select
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: 'none', label: 'Never' },
              ]}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value as ExpiryOption)}
              className="w-auto"
            />
            <Button onClick={generateInvite} loading={creating}>
              {creating ? 'Generating…' : 'Generate invite link'}
            </Button>
          </div>
          {newLink && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 space-y-2">
              <p className="text-xs text-zinc-400">Share this link — it can only be used once:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs text-indigo-300 font-mono">{newLink}</code>
                <Button variant="secondary" size="sm" onClick={() => copyLink(newLink)}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="All invites">
        {invites.length === 0 ? (
          <p className="text-sm text-zinc-500">No invites yet.</p>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?invite=${invite.token}`;
              return (
                <li
                  key={invite.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                >
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{status}</span>
                  <code className="flex-1 truncate text-xs text-zinc-400 font-mono">{invite.token.slice(0, 16)}…</code>
                  {invite.expiresAt && status !== 'used' && (
                    <span className="text-xs text-zinc-500 shrink-0">
                      {status === 'expired' ? 'Expired' : 'Expires'} {new Date(invite.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  {status === 'used' && invite.usedAt && (
                    <span className="text-xs text-zinc-500 shrink-0">
                      Used {new Date(invite.usedAt).toLocaleDateString()}
                      {invite.usedByEmail && <span className="ml-1">by {invite.usedByEmail}</span>}
                    </span>
                  )}
                  {status === 'pending' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => copyLink(link)}>
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={revoking === invite.id}
                        onClick={() => revoke(invite.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
