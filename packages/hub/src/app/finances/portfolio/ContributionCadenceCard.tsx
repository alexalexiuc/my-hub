'use client';

import { Card, Pill, ProgressBar } from '@/components';
import { fmt, fmtSign } from '../ui';
import { ContributionCadenceStatuses, type ContributionCadenceStatus } from '@my-hub/shared/constants';
import type { ContributionCadence } from '@my-hub/shared/utils';
import { formatMonthStr } from '@my-hub/shared/utils';

type ContributionCadenceCardProps = {
  cadence: ContributionCadence;
  currency: string;
};

const STATUS_META: Record<ContributionCadenceStatus, { label: string; color: string }> = {
  [ContributionCadenceStatuses.Ahead]: { label: 'Ahead of schedule', color: 'var(--green)' },
  [ContributionCadenceStatuses.OnTrack]: { label: 'On track', color: 'var(--blue)' },
  [ContributionCadenceStatuses.Behind]: { label: 'Behind schedule', color: 'var(--amber)' },
};

/** Pluralises a whole number of months: 1 → "1 month", 2 → "2 months". */
function months(n: number): string {
  return `${n} month${n === 1 ? '' : 's'}`;
}

/**
 * Where the monthly contribution plan stands: how far ahead or behind the
 * contributed cash is, and which month the next round of buying falls due.
 */
export function ContributionCadenceCard({ cadence, currency }: ContributionCadenceCardProps) {
  const status = STATUS_META[cadence.status];
  const behind = cadence.status === ContributionCadenceStatuses.Behind;

  // The headline answers "when do I buy next?" — the one question the card exists for.
  const headline = cadence.dueNow ? 'Due now' : formatMonthStr(cadence.nextContributionMonth);
  const headlineColor = cadence.dueNow ? (behind ? 'var(--amber)' : 'var(--text)') : 'var(--green)';

  // "Overdue since March" only makes sense once that month has passed — while
  // the due month is still running, the contribution is simply outstanding.
  const overdue = cadence.dueNow && cadence.nextContributionMonth < cadence.currentMonth;
  const detail = cadence.dueNow
    ? overdue
      ? `Outstanding since ${formatMonthStr(cadence.nextContributionMonth)} — ${fmt(cadence.amountDueNow, currency)} behind plan`
      : `This month's ${fmt(cadence.plannedMonthlyContribution, currency)} has not been contributed yet`
    : cadence.monthsAhead > 0
      ? `${months(cadence.monthsAhead)} already funded — you can skip until then`
      : 'This month is covered';

  return (
    <Card className="p-[14px]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">Contribution cadence</span>
        <Pill label={status.label} color={status.color} />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[10px] uppercase tracking-[0.07em] text-[var(--subtle)]">Next contribution</span>
        <span className="text-[18px] font-bold tracking-[-0.02em]" style={{ color: headlineColor }}>
          {headline}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--subtle)]">{detail}</div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--subtle)]">
          <span>
            {fmt(cadence.contributedToDate, currency)} of {fmt(cadence.expectedToDate, currency)} planned
          </span>
          <span style={{ color: behind ? 'var(--amber)' : 'var(--green)' }}>
            {cadence.difference === 0 ? 'Exactly on plan' : fmtSign(cadence.difference, currency)}
          </span>
        </div>
        <ProgressBar
          value={cadence.contributedToDate}
          max={cadence.expectedToDate}
          color={behind ? 'var(--amber)' : 'var(--green)'}
          thresholds={false}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] md:grid-cols-4">
        <Detail label="Planned" value={`${fmt(cadence.plannedMonthlyContribution, currency)} / month`} />
        <Detail label="Plan started" value={formatMonthStr(cadence.anchorMonth)} />
        <Detail
          label="Covered through"
          value={cadence.coveredThroughMonth ? formatMonthStr(cadence.coveredThroughMonth) : '—'}
        />
        <Detail
          label="Vs. plan"
          value={
            cadence.monthsDifference === 0
              ? 'On plan'
              : `${cadence.monthsDifference > 0 ? '+' : '−'}${Math.abs(cadence.monthsDifference).toFixed(1)} months`
          }
        />
      </dl>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">{label}</dt>
      <dd className="text-[var(--text)]">{value}</dd>
    </div>
  );
}
