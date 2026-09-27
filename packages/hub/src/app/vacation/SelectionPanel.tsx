'use client';

import { useEffect, useState } from 'react';
import type { VacationSpanResult } from '@my-hub/shared/services';
import type { VacationCalendarRow } from '@my-hub/shared/utils';
import { Card } from '@/components';
import { apiFetch } from '@/lib/utils';
import { MARKER_LABELS, formatDays, formatMdl, formatSignedMdl } from './vacation.utils';

type SelectionPanelProps = {
  range: [string, string];
  /** The calendar row when a single day is selected. */
  dayRow: VacationCalendarRow | undefined;
  includeDraftRules: boolean;
};

/** Totals for the selected day or span, priced as one leave with the rate of its start month. */
export function SelectionPanel({ range, dayRow, includeDraftRules }: SelectionPanelProps) {
  const [startDate, endDate] = range;
  const [result, setResult] = useState<VacationSpanResult | null>(null);

  useEffect(() => {
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
  }, [startDate, endDate, includeDraftRules]);

  const span = result?.span;
  const markers = startDate === endDate ? (dayRow?.[4] ?? []) : [];

  return (
    <Card compact className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{startDate === endDate ? startDate : `${startDate} → ${endDate}`}</h2>
        {markers.length > 0 && (
          <span className="text-xs text-[var(--muted)]">{markers.map(m => MARKER_LABELS[m]).join(' · ')}</span>
        )}
      </div>
      {span ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="vs working" value={formatSignedMdl(span.deltaNet)} tone={span.deltaNet >= 0 ? 'gain' : 'loss'} />
          <Stat label="Leave pay" value={formatMdl(span.amountNet)} />
          <Stat label="Balance cost" value={formatDays(span.balanceCost)} />
          <Stat label="Rest" value={`${formatDays(span.restDays)} (${span.restFrom} → ${span.restTo})`} />
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
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  const color = tone === 'gain' ? 'text-[var(--green)]' : tone === 'loss' ? 'text-[var(--red)]' : '';
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className={`font-medium tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
