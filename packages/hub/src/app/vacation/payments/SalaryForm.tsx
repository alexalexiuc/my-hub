'use client';

import { useState } from 'react';
import type { SalaryKind } from '@my-hub/shared/constants';
import type { VacationSalaryRow } from '@my-hub/shared/services';
import { Button, Card, Field, Input, Select } from '@/components';
import { apiFetch } from '@/lib/utils';
import { SALARY_KIND_LABELS } from '../constants';
import { blankToNull, parseOptionalNumber } from '../vacation.utils';

type SalaryFormProps = {
  /** The month being edited, or null to add one. */
  salary: VacationSalaryRow | null;
  onSaved: () => void;
  onCancel: () => void;
};

const KIND_OPTIONS = Object.entries(SALARY_KIND_LABELS).map(([value, label]) => ({ value, label }));

/** Adds or edits the gross salary earned in one month. Salaries are keyed by month, so saving an existing month overwrites it. */
export function SalaryForm({ salary, onSaved, onCancel }: SalaryFormProps) {
  const [month, setMonth] = useState(salary?.month ?? '');
  const [base, setBase] = useState(salary ? String(salary.baseMdl) : '');
  const [extra, setExtra] = useState(salary?.extraMdl ? String(salary.extraMdl) : '');
  const [kind, setKind] = useState<SalaryKind>(salary?.kind ?? 'actual');
  const [notes, setNotes] = useState(salary?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const baseMdl = parseOptionalNumber(base);
  const extraMdl = parseOptionalNumber(extra) ?? 0;
  const canSave = /^\d{4}-\d{2}$/.test(month) && baseMdl !== null && baseMdl >= 0 && extraMdl >= 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await apiFetch('/api/vacation/salaries', {
        method: 'PUT',
        body: { month, baseMdl, extraMdl, kind, notes: blankToNull(notes) },
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
      <form onSubmit={save} className="space-y-3" aria-label={salary ? 'Edit payment' : 'Add payment'}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Month" info="The month the salary was earned in, not the month it was paid.">
            {/* The month is the row's key: editing it would silently create a second row. */}
            <Input type="month" value={month} disabled={!!salary} onChange={e => setMonth(e.target.value)} />
          </Field>
          <Field label="Kind" info="Projected salaries price future leave until the actual figure is known.">
            <Select value={kind} options={KIND_OPTIONS} onChange={e => setKind(e.target.value as SalaryKind)} />
          </Field>
          <Field label="Base salary (MDL, gross)" info="Carries forward to later months that have no row of their own.">
            <Input type="number" min={0} step="0.01" value={base} onChange={e => setBase(e.target.value)} />
          </Field>
          <Field
            label="Extra (MDL, gross)"
            info="Bonuses and allowances counted for this month only — never carried forward."
          >
            <Input type="number" min={0} step="0.01" value={extra} onChange={e => setExtra(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Raise" />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="accent" disabled={!canSave || saving}>
            {saving ? 'Saving…' : salary ? 'Save payment' : 'Add payment'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
