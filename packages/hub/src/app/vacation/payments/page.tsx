'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VacationSalaryRow } from '@my-hub/shared/services';
import { formatMonthStr } from '@my-hub/shared/utils';
import { Button, Card, ConfirmModal, IconButton, PageHeader } from '@/components';
import { PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { SALARY_KIND_LABELS } from '../constants';
import { formatMdl } from '../vacation.utils';
import { SalaryForm } from './SalaryForm';

/** `null` = form closed, `'new'` = adding, a salary row = editing it. */
type Editing = null | 'new' | VacationSalaryRow;

export default function VacationPaymentsPage() {
  const [salaries, setSalaries] = useState<VacationSalaryRow[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<VacationSalaryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch<VacationSalaryRow[]>('/api/vacation/salaries');
      setSalaries([...rows].reverse());
    } catch {
      // apiFetch already surfaced the error as a toast.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/vacation/salaries/${deleting.month}`, { method: 'DELETE' });
      setDeleting(null);
      await load();
    } catch {
      // apiFetch already surfaced the error as a toast.
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Payments"
        actions={
          editing === null && (
            <Button variant="accent" size="sm" onClick={() => setEditing('new')}>
              Add payment
            </Button>
          )
        }
      />
      <p className="text-xs text-[var(--subtle)]">
        Monthly gross salaries. Leave pay is the average of the months before a leave starts, so keep the last few
        months filled in.
      </p>

      {editing !== null && (
        <SalaryForm
          key={editing === 'new' ? 'new' : editing.month}
          salary={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {salaries?.length === 0 && editing === null && (
        <Card compact>
          <p className="text-sm text-[var(--muted)]">No payments recorded yet.</p>
        </Card>
      )}

      {salaries && salaries.length > 0 && (
        <ul className="space-y-2">
          {salaries.map(s => (
            <li key={s.month} data-month={s.month}>
              <Card compact className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="font-semibold">{formatMonthStr(s.month)}</span>
                    <span className="text-xs text-[var(--subtle)]">{SALARY_KIND_LABELS[s.kind]}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {formatMdl(s.baseMdl)}
                    {s.extraMdl > 0 && ` + ${formatMdl(s.extraMdl)} extra`}
                    {s.notes && ` · ${s.notes}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label="Edit payment"
                    icon={<PencilIcon className="size-4" />}
                    onClick={() => setEditing(s)}
                  />
                  <IconButton
                    label="Delete payment"
                    icon={<TrashOutlineIcon className="size-4" />}
                    onClick={() => setDeleting(s)}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete payment?"
          message={`The salary for ${formatMonthStr(deleting.month)} will be removed; the month before it carries forward instead.`}
          confirmLabel="Delete"
          loading={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
