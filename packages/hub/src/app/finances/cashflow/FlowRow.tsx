'use client';

import { cn } from '@/lib/utils';
import { fmt, fmtSign } from '../ui';

type Tone = 'in' | 'out';

function AmountCell({ value, tone, currency }: { value: number; tone: Tone; currency: string }) {
  const isZero = value === 0;
  return (
    <span
      className={cn(
        'text-right text-[11px] tabular-nums sm:text-xs',
        isZero ? 'text-[var(--subtle)]' : tone === 'in' ? 'text-[var(--green)]' : 'text-[var(--red)]',
      )}
    >
      {isZero ? '' : tone === 'in' ? '+' : '-'}
      {fmt(value, currency)}
    </span>
  );
}

type FlowRowProps = {
  /** Period label, e.g. 'Sep'. */
  label: string;
  inflow: number;
  outflow: number;
  currency: string;
  /** Draws a hairline under the row — leave off for the last row of a list. */
  divider?: boolean;
};

/** One period's money in, money out and net, shared by the Monthly and By Account views. */
export function FlowRow({ label, inflow, outflow, currency, divider = false }: FlowRowProps) {
  const net = inflow - outflow;

  return (
    // Fractional columns rather than fixed widths — four money columns do not fit a phone otherwise.
    <div
      className={cn(
        'grid grid-cols-[2.75rem_repeat(3,minmax(0,1fr))] items-center gap-1.5 py-1.5',
        divider && 'border-b border-[var(--border)]/[.13]',
      )}
    >
      <span className="text-[11px] text-[var(--muted)] sm:text-xs">{label}</span>
      <AmountCell value={inflow} tone="in" currency={currency} />
      <AmountCell value={outflow} tone="out" currency={currency} />
      <span
        className={cn(
          'text-right text-[11px] font-semibold tabular-nums sm:text-xs',
          net === 0 ? 'text-[var(--subtle)]' : net > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]',
        )}
      >
        {net === 0 ? fmt(0, currency) : fmtSign(net, currency)}
      </span>
    </div>
  );
}
