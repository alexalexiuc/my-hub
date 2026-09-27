'use client';

import { useState } from 'react';
import type { LeaveStatus } from '@my-hub/shared/constants';
import type { VacationLeavePeriod } from '@my-hub/shared/types';
import { Button, Card, Field, Input, Select } from '@/components';
import { apiFetch } from '@/lib/utils';
import { LEAVE_STATUS_LABELS } from '../constants';
import { blankToNull, parseOptionalNumber } from '../vacation.utils';

type LeaveFormProps = {
  /** The leave being edited, or null to record new leave. */
  leave: VacationLeavePeriod | null;
  onSaved: () => void;
  onCancel: () => void;
};

const STATUS_OPTIONS = Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** Records a new leave period or edits an existing one. */
export function LeaveForm({ leave, onSaved, onCancel }: LeaveFormProps) {
  const [startDate, setStartDate] = useState(leave?.startDate ?? '');
  const [endDate, setEndDate] = useState(leave?.endDate ?? '');
  const [status, setStatus] = useState<LeaveStatus>(leave?.status ?? 'planned');
  const [payReceived, setPayReceived] = useState(leave?.payReceivedMdl != null ? String(leave.payReceivedMdl) : '');
  const [notes, setNotes] = useState(leave?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const validRange = !!startDate && !!endDate && startDate <= endDate;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validRange) return;
    setSaving(true);
    try {
      await apiFetch('/api/vacation/leave', {
        method: 'POST',
        body: {
          id: leave?.id,
          startDate,
          endDate,
          status,
          payReceivedMdl: parseOptionalNumber(payReceived),
          notes: blankToNull(notes),
        },
      });
      onSaved();
    } catch {
      // apiFetch already surfaced the error as a toast.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card compact>
      <form onSubmit={save} className="space-y-3" aria-label={leave ? 'Edit vacation' : 'Add vacation'}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First day">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
          <Field label="Last day">
            <Input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
            />
          </Field>
          <Field label="Status">
            <Select value={status} options={STATUS_OPTIONS} onChange={e => setStatus(e.target.value as LeaveStatus)} />
          </Field>
          <Field label="Pay received (MDL)" info="Optional: what the employer actually paid for this leave.">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={payReceived}
              onChange={e => setPayReceived(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Summer trip" />
        </Field>
        {startDate && endDate && !validRange && (
          <p className="text-xs text-[var(--amber)]">The last day cannot be before the first.</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="accent" disabled={!validRange || saving}>
            {saving ? 'Saving…' : leave ? 'Save vacation' : 'Add vacation'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
