'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { Button, Input } from '@/components';
import { Card, SectionLabel } from '../ui';
import { ClaudePromptSection } from './ClaudePromptSection';
import { BudgetsSection } from './BudgetsSection';
import type { BudgetDetailResponse } from '@/app/api/finances/budget/route';

export default function FinancesSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<BudgetDetailResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<BudgetDetailResponse>('/api/finances/budget', { silentToast: true });
    setData(result);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteBudget() {
    setDeleting(true);
    try {
      await apiFetch('/api/finances/budget', { method: 'DELETE', body: {} });
      router.push('/finances');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingUserId(userId);
    try {
      await apiFetch('/api/finances/budget', {
        method: 'DELETE',
        body: { removeMemberUserId: userId },
        silentToast: true,
      });
      await load();
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleInviteMember() {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    try {
      await apiFetch('/api/finances/budget/members', {
        method: 'POST',
        body: { email },
        silentToast: true,
      });
      setInviteEmail('');
      await load();
    } catch {
      setInviteError('User not found or already a member.');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[18px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Settings</div>

      <BudgetsSection onChanged={load} />

      {!data ? (
        <div className="flex flex-col gap-[14px]">
          {[140, 100].map((h, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
              style={{ height: h, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Members */}
          <Card className="p-[18px]">
            <SectionLabel className="mb-3">Members</SectionLabel>
            <div className="flex flex-col gap-2">
              {data.members.map(m => {
                const isCreator = m.userId === data.budget.createdByUserId;
                const isRemoving = removingUserId === m.userId;
                return (
                  <div key={m.userId} className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold bg-[var(--fin-accent-d)] text-[var(--fin-accent)]"
                      style={{ border: `1px solid var(--fin-accent)44` }}
                    >
                      {(m.name ?? m.email)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[var(--fin-text)]">{m.name ?? m.email}</div>
                      {m.name && <div className="text-[11px] text-[var(--fin-subtle)]">{m.email}</div>}
                    </div>
                    {isCreator && (
                      <span
                        className="rounded-[20px] bg-[var(--fin-accent-d)] px-2 py-[2px] text-[10px] text-[var(--fin-accent)]"
                        style={{ border: `1px solid var(--fin-accent)44` }}
                      >
                        Owner
                      </span>
                    )}
                    {!isCreator && data.budget.isOwner && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={isRemoving}
                        className="text-red-400 hover:text-red-300"
                      >
                        {isRemoving ? '…' : 'Remove'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {data.budget.isOwner && (
              <div className="mt-4 border-t border-[var(--fin-border)] pt-4">
                <div className="mb-1.5 text-[11px] text-[var(--fin-subtle)]">Invite member by email</div>
                <div className="flex gap-2">
                  <Input
                    value={inviteEmail}
                    onChange={e => {
                      setInviteEmail(e.target.value);
                      setInviteError(null);
                    }}
                    placeholder="colleague@example.com"
                    className="flex-1 text-[13px]"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleInviteMember();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleInviteMember()}
                    disabled={!inviteEmail.trim() || inviting}
                  >
                    {inviting ? '…' : 'Invite'}
                  </Button>
                </div>
                {inviteError && <p className="mt-1 text-[11px] text-[var(--fin-red)]">{inviteError}</p>}
              </div>
            )}
          </Card>

          {/* Claude prompt generator */}
          <ClaudePromptSection budget={data.budget} />

          {/* Danger zone */}
          <Card compact className="p-[18px]" style={{ border: `1px solid var(--fin-red)33` }}>
            <SectionLabel className="mb-2 text-[var(--fin-red)]">Danger zone</SectionLabel>
            <p className="mb-3 text-xs text-[var(--fin-muted)]">
              Permanently deletes this budget and all associated accounts, categories, and transactions. This cannot be
              undone.
            </p>
            {!confirmDelete ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete budget…
              </Button>
            ) : (
              <div
                className="flex flex-col gap-2.5 rounded-[10px] bg-[var(--fin-red-d)] p-[14px]"
                style={{ border: `1px solid var(--fin-red)44` }}
              >
                <p className="text-[13px] font-medium text-[var(--fin-red)]">
                  Are you sure? All data will be permanently deleted.
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={handleDeleteBudget} loading={deleting}>
                    Yes, delete everything
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
