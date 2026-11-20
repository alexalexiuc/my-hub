import { formatMoney } from '@my-hub/shared/utils';
import type { DrawdownEtf } from '@my-hub/shared/services';
import { cn } from '@/lib/utils';
import { formatDrawdown } from './drawdown.utils';

type DipGaugeBreakdownProps = {
  etfs: DrawdownEtf[];
  currency: string;
};

/** A row stands out when this ETF alone pulls the basket down by at least this many percentage points. */
const SINGLE_ETF_RULE_PP = 2;

/** Per-ETF price, 30d / 52w drawdown and its weighted pull on the basket; highlights the single-ETF rule. */
export function DipGaugeBreakdown({ etfs, currency }: DipGaugeBreakdownProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular-nums" data-testid="dip-gauge-breakdown">
        <thead>
          <tr className="text-[10px] text-[var(--muted)]">
            <th className="py-1 text-left font-medium">ETF</th>
            <th className="py-1 text-right font-medium">Price</th>
            <th className="py-1 text-right font-medium">30d</th>
            <th className="py-1 text-right font-medium">52w</th>
            <th className="py-1 text-right font-medium">dd × wt</th>
          </tr>
        </thead>
        <tbody>
          {etfs.map(etf => {
            const flagged = -etf.ddTimesWeightPp >= SINGLE_ETF_RULE_PP;
            return (
              <tr key={etf.symbol} className={cn('border-t border-[var(--border)]', flagged && 'bg-[var(--amber-d)]')}>
                <td className="py-1.5 text-left font-semibold text-[var(--text)]">
                  {etf.symbol}
                  <span className="ml-1 text-[10px] font-normal text-[var(--muted)]">
                    {Math.round(etf.weight * 100)}%
                  </span>
                </td>
                <td className="py-1.5 text-right text-[var(--text)]">{formatMoney(etf.price, currency)}</td>
                <td className="py-1.5 text-right text-[var(--text)]">{formatDrawdown(etf.dd30)}</td>
                <td className="py-1.5 text-right text-[var(--text)]">{formatDrawdown(etf.dd52)}</td>
                <td
                  className={cn(
                    'py-1.5 text-right',
                    flagged ? 'font-semibold text-[var(--amber)]' : 'text-[var(--muted)]',
                  )}
                >
                  {formatDrawdown(etf.ddTimesWeightPp / 100).replace('%', ' pp')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        Highlighted when one ETF's drawdown × target weight is {SINGLE_ETF_RULE_PP} pp or more.
      </p>
    </div>
  );
}
