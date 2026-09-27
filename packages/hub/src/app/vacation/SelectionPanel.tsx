'use client';

import { useEffect, useState } from 'react';
import type { VacationLeaveEstimate, VacationSpanResult } from '@my-hub/shared/services';
import type { VacationCalendarRow } from '@my-hub/shared/utils';
import { Button, Card } from '@/components';
import { apiFetch, cn } from '@/lib/utils';
import { LEAVE_STATUS_LABELS } from './constants';
import { LeaveDetails } from './LeaveDetails';
import { VacationStat } from './VacationStat';
import { MARKER_LABELS, formatDays, formatMdl, formatSignedMdl } from './vacation.utils';

type SelectionPanelProps = {
  range: [string, string];
  /** The calendar row when a single day is selected. */
  dayRow: VacationCalendarRow | undefined;
  /** The recorded leave the selection starts in, if any. */
  leave: VacationLeaveEstimate | undefined;
  includeDraftRules: boolean;
  /** Selects the whole of `leave`. */
  onShowLeave: () => void;
};

/**
 * Totals for the selected day or span, priced as one leave with the rate of its start month. A
 * selection that is exactly a recorded leave shows that leave's own totals instead.
 */
export function SelectionPanel({ range, dayRow, leave, includeDraftRules, onShowLeave }: SelectionPanelProps) {
  const [startDate, endDate] = range;
  const isWholeLeave = leave !== undefined && leave.startDate === startDate && leave.endDate === endDate;
  const [result, setResult] = useState<VacationSpanResult | null>(null);

  useEffect(() => {
    if (isWholeLeave) return;
    let cancelled = false;
    apiFetch<VacationSpanResult>('/api/vacation/span', {
      query: { startDate, endDate, includeDraftRules },
      silentToast: true,
    })
      .then(data => !cancelled && setResult(data))
      .catch(() => !cancelled && setResult(null));
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, includeDraftRules, isWholeLeave]);

  const span = result?.span;
  const markers = startDate === endDate ? (dayRow?.[4] ?? []) : [];

  return (
    <Card compact className="space-y-3">
      {leave && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--bg)] px-2 py-1.5 text-xs">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2 py-px font-medium',
                leave.status === 'taken'
                  ? 'border-[var(--violet)] text-[var(--violet)]'
                  : 'border-dashed border-[var(--blue)] text-[var(--blue)]',
              )}
            >
              {LEAVE_STATUS_LABELS[leave.status]}
            </span>
            <span className="font-semibold">
              {leave.startDate} → {leave.endDate}
            </span>
            {leave.notes && <span className="text-[var(--muted)]">{leave.notes}</span>}
          </span>
          {!isWholeLeave && (
            <Button size="xs" variant="secondary" onClick={onShowLeave}>
              Show whole vacation
            </Button>
          )}
        </div>
      )}

      {isWholeLeave ? (
        <LeaveDetails leave={leave} />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{startDate === endDate ? startDate : `${startDate} → ${endDate}`}</h2>
            {markers.length > 0 && (
              <span className="text-xs text-[var(--muted)]">{markers.map(m => MARKER_LABELS[m]).join(' · ')}</span>
            )}
          </div>
          {span ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <VacationStat
                label="vs working"
                value={formatSignedMdl(span.deltaNet)}
                tone={span.deltaNet >= 0 ? 'gain' : 'loss'}
              />
              <VacationStat label="Leave pay" value={formatMdl(span.amountNet)} />
              <VacationStat label="Balance cost" value={formatDays(span.balanceCost)} />
              <VacationStat label="Rest" value={`${formatDays(span.restDays)} (${span.restFrom} → ${span.restTo})`} />
            </dl>
          ) : (
            <p className="text-sm text-[var(--muted)]">Calculating…</p>
          )}
          {result?.rate && (
            <p className="text-xs text-[var(--muted)]">
              Rate {formatMdl(result.rate.rateGross)} gross per paid day ({result.rate.rateBasis.replace('_', ' ')}),
              averaged over {result.rate.windowMonths.join(', ')}.
            </p>
          )}
          {result && result.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--amber)]">
              {result.warnings.map(w => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
