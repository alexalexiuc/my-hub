'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import type { DepositActionBody, DepositActionResponse } from '@/app/api/finances/accounts/[id]/deposit/route';
import { Input, Select, SubText } from '@/components';
import { FinModalShell } from '../FinModalShell';
import { FinFieldCard } from '../ui';
import { finGhostInputClass as ghostInputClass } from '../finances.utils';

type DepositCloseModalProps = {
  accountId: number;
  name: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
};

const REASON_OPTIONS = [
  { value: 'matured', label: 'Matured (held to term)' },
  { value: 'broken', label: 'Broken early' },
];

/** Closes a deposit: returns the balance to the return account and archives it. */
export function DepositCloseModal({ accountId, name, currency, onClose, onDone }: DepositCloseModalProps) {
  const [reason, setReason] = useState<'matured' | 'broken'>('matured');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clawback, setClawback] = useState('');
  const [returnAmount, setReturnAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const clawbackAmount = parseFloat(clawback);
      const returned = parseFloat(returnAmount);
      await apiFetch<DepositActionResponse, DepositActionBody>(`/api/finances/accounts/${accountId}/deposit`, {
        method: 'POST',
        body: {
          action: 'close',
          reason,
          date,
          ...(reason === 'broken' && clawbackAmount > 0 ? { clawbackAmount } : {}),
          ...(returned > 0 ? { returnAmount: returned } : {}),
        },
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={`Close ${name}`}
      className="md:max-w-[380px]"
      onSubmit={submit}
      submitLabel="Close deposit"
      submitLoading={saving}
    >
      <div className="flex flex-col gap-2">
        <FinFieldCard label="Reason">
          <Select
            value={reason}
            onChange={e => setReason(e.target.value as 'matured' | 'broken')}
            options={REASON_OPTIONS}
            aria-label="Close reason"
            className="w-full border-none bg-transparent px-0 py-0.5 text-[13px]"
          />
        </FinFieldCard>
        <FinFieldCard label="Return date">
          <Input
            value={date}
            onChange={e => setDate(e.target.value)}
            type="date"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        {reason === 'broken' && (
          <FinFieldCard label={`Interest clawed back (${currency}, optional)`}>
            <Input
              value={clawback}
              onChange={e => setClawback(e.target.value)}
              type="number"
              step="0.01"
              variant="ghost"
              className={ghostInputClass}
            />
          </FinFieldCard>
        )}
        <FinFieldCard label="Amount credited if the return account uses another currency (optional)">
          <Input
            value={returnAmount}
            onChange={e => setReturnAmount(e.target.value)}
            type="number"
            step="0.01"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        <SubText className="block leading-normal">
          The whole balance returns to the return account as a transfer, and the deposit is archived so it leaves net
          worth.
        </SubText>
      </div>
    </FinModalShell>
  );
}
