'use client';

import type { VacationLeaveEstimate } from '@my-hub/shared/services';
import { formatDays, formatMdl, formatSignedMdl, leaveDelta } from './vacation.utils';
import { VacationStat } from './VacationStat';

type LeaveDetailsProps = {
  leave: VacationLeaveEstimate;
};

/** Totals for one recorded leave period: pay, net vs working, balance cost, rest and the rate used. */
export function LeaveDetails({ leave }: LeaveDetailsProps) {
  const { estimate, rate, payReceivedMdl } = leave;
  const delta = leaveDelta(leave);

  if (!estimate || !delta) {
    return (
      <p className="text-xs text-[var(--muted)]">
        No salary is recorded for the months this leave's pay is averaged over, so it can't be estimated.
        {payReceivedMdl != null && ` Paid ${formatMdl(payReceivedMdl)}.`}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <VacationStat
          label={delta.actual ? 'vs working (actual)' : 'vs working (est.)'}
          value={formatSignedMdl(delta.value)}
          tone={delta.value >= 0 ? 'gain' : 'loss'}
        />
        <VacationStat
          label={payReceivedMdl != null ? 'Paid' : 'Leave pay (est.)'}
          value={formatMdl(payReceivedMdl ?? estimate.amountNet)}
        />
        <VacationStat label="Balance cost" value={formatDays(estimate.balanceCost)} />
        <VacationStat
          label="Rest"
          value={`${formatDays(estimate.restDays)} (${estimate.restFrom} → ${estimate.restTo})`}
        />
      </dl>
      <p className="text-xs text-[var(--muted)]">
        {estimate.workdays} working {estimate.workdays === 1 ? 'day' : 'days'} of {estimate.calendarDays} · salary
        forgone {formatMdl(estimate.amountNet - estimate.deltaNet)}
        {payReceivedMdl != null && ` · estimated pay was ${formatMdl(estimate.amountNet)}`}
        {rate &&
          ` · rate ${formatMdl(rate.rateGross)} gross per paid day, averaged over ${rate.windowMonths.join(', ')} (${rate.ruleSetName})`}
      </p>
    </div>
  );
}
