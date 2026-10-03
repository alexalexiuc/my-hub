'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VacationLeaveEstimate, VacationLeaveEstimatesResult } from '@my-hub/shared/services';
import type { VacationLeavePeriod } from '@my-hub/shared/types';
import { Button, Card, ConfirmModal, IconButton, PageHeader } from '@/components';
import { ChevronDownOutlineIcon, PencilIcon, TrashOutlineIcon } from '@/components/icons';
import { apiFetch, cn } from '@/lib/utils';
import { LEAVE_STATUS_LABELS } from '../constants';
import { LeaveDetails } from '../LeaveDetails';
import { formatMdl, formatSignedMdl, leaveDelta, spanDays } from '../vacation.utils';
import { LeaveForm } from './LeaveForm';

/** `null` = form closed, `'new'` = adding, a leave period = editing it. */
type Editing = null | 'new' | VacationLeavePeriod;

export default function VacationLeavePage() {
  const [leave, setLeave] = useState<VacationLeaveEstimate[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<VacationLeavePeriod | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<VacationLeaveEstimatesResult>('/api/vacation/leave');
      // Newest first: upcoming plans are what this page is opened for.
      setLeave([...result.leave].reverse());
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
      await apiFetch(`/api/vacation/leave/${deleting.id}`, { method: 'DELETE' });
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
        title="Vacations"
        actions={
          editing === null && (
            <Button variant="accent" size="sm" onClick={() => setEditing('new')}>
              Add vacation
            </Button>
          )
        }
      />

      {editing !== null && (
        <LeaveForm
          key={editing === 'new' ? 'new' : editing.id}
          leave={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {leave?.length === 0 && editing === null && (
        <Card compact>
          <p className="text-sm text-[var(--muted)]">No vacations recorded yet.</p>
        </Card>
      )}

      {leave && leave.length > 0 && (
        <ul className="space-y-2">
          {leave.map(l => {
            const delta = leaveDelta(l);
            const open = expanded === l.id;
            return (
              <li key={l.id} data-leave-id={l.id}>
                <Card compact className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : l.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span>
                          {l.startDate} → {l.endDate}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-px text-[11px] font-medium',
                            l.status === 'taken'
                              ? 'border-[var(--violet)] text-[var(--violet)]'
                              : 'border-dashed border-[var(--blue)] text-[var(--blue)]',
                          )}
                        >
                          {LEAVE_STATUS_LABELS[l.status]}
                        </span>
                        <ChevronDownOutlineIcon
                          className={cn('size-3.5 text-[var(--muted)] transition-transform', open && 'rotate-180')}
                        />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {spanDays(l.startDate, l.endDate)} days
                        {delta && (
                          <>
                            {' · '}
                            <span className={delta.value >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                              {formatSignedMdl(delta.value)}
                            </span>
                            {delta.actual ? '' : ' est.'}
                          </>
                        )}
                        {l.payReceivedMdl != null && ` · paid ${formatMdl(l.payReceivedMdl)}`}
                        {l.notes && ` · ${l.notes}`}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        label="Edit vacation"
                        icon={<PencilIcon className="size-4" />}
                        onClick={() => setEditing(l)}
                      />
                      <IconButton
                        label="Delete vacation"
                        icon={<TrashOutlineIcon className="size-4" />}
                        onClick={() => setDeleting(l)}
                      />
                    </div>
                  </div>
                  {open && <LeaveDetails leave={l} />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete vacation?"
          message={`${deleting.startDate} → ${deleting.endDate} will be removed from your balance and calendar.`}
          confirmLabel="Delete"
          loading={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
