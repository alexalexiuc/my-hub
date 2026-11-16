'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { DepositActionBody, DepositActionResponse } from '@/app/api/finances/accounts/[id]/deposit/route';
import { Input, SubText } from '@/components';
import { FinModalShell } from '../FinModalShell';
import { FinFieldCard } from '../ui';
import { finGhostInputClass as ghostInputClass } from '../finances.utils';

type DepositInterestModalProps = {
  accountId: number;
  currency: string;
  /** Pre-filled from the next scheduled payout. */
  suggestedNet: number | null;
  onClose: () => void;
  onDone: () => void;
};

/** Logs one interest payout (net, after tax withheld) for a deposit. */
export function DepositInterestModal({
  accountId,
  currency,
  suggestedNet,
  onClose,
  onDone,
}: DepositInterestModalProps) {
  const [net, setNet] = useState(suggestedNet != null ? String(suggestedNet) : '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const parsed = parseFloat(net);
      await apiFetch<DepositActionResponse, DepositActionBody>(`/api/finances/accounts/${accountId}/deposit`, {
        method: 'POST',
        body: { action: 'recordInterest', date, ...(isNaN(parsed) ? {} : { net: parsed }) },
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title="Log interest"
      className="md:max-w-[380px]"
      onSubmit={submit}
      submitLabel="Record interest"
      submitLoading={saving}
    >
      <div className="flex flex-col gap-2">
        <FinFieldCard label={`Net interest received (${currency})`}>
          <Input
            value={net}
            onChange={e => setNet(e.target.value)}
            type="number"
            step="0.01"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        <FinFieldCard label="Date">
          <Input
            value={date}
            onChange={e => setDate(e.target.value)}
            type="date"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        <SubText className="block leading-normal">
          Net means after tax withheld by the bank. It lands in the payout account as income; the tax share comes from
          the deposit&apos;s tax rate.
        </SubText>
      </div>
    </FinModalShell>
  );
}
