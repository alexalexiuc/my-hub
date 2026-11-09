import { formatMoney } from '@my-hub/shared/utils';
import type { HistorySeries, HistorySummary } from './portfolio.utils';

type HistoryHeadlineProps = {
  summary: HistorySummary;
  series: HistorySeries;
  currency: string;
  /** Lower-case range description, e.g. "last month", "since the last buy". */
  rangeLabel: string;
  targetAmount: number | null;
};

const signColor = (v: number) => (v >= 0 ? 'var(--green)' : 'var(--red)');

/** Big number + range change above the portfolio value chart; what it leads with follows the plotted series. */
export function HistoryHeadline({ summary, series, currency, rangeLabel, targetAmount }: HistoryHeadlineProps) {
  const big = series === 'value' ? summary.endValue : series === 'profit' ? summary.totalGain : summary.endInvested;
  const pct = summary.gainPct !== null ? ` (${summary.gainPct >= 0 ? '+' : ''}${summary.gainPct.toFixed(2)}%)` : '';

  return (
    <div className="mb-3">
      <div
        className="text-[26px] font-bold leading-tight"
        style={{ color: series === 'profit' ? signColor(big) : 'var(--text)' }}
      >
        {formatMoney(big, currency, { signed: series === 'profit' })}
      </div>
      {series === 'invested' ? (
        <div className="mt-0.5 text-[12px] text-[var(--muted)]">
          <span className="text-[var(--text)]">+{formatMoney(summary.deposits, currency)}</span> added, {rangeLabel}
        </div>
      ) : (
        <div className="mt-0.5 text-[12px]" style={{ color: signColor(summary.gain) }}>
          {formatMoney(summary.gain, currency, { signed: true })}
          {pct}
          <span className="text-[var(--muted)]">
            {' '}
            {series === 'profit' ? 'profit change' : 'market gain'}, {rangeLabel}
          </span>
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--muted)]">
        {series !== 'invested' && summary.deposits > 0 && <span>+{formatMoney(summary.deposits, currency)} added</span>}
        {series !== 'profit' && (
          <span>
            Total gain{' '}
            <span style={{ color: signColor(summary.totalGain) }}>
              {formatMoney(summary.totalGain, currency, { signed: true })}
            </span>
          </span>
        )}
        {series === 'profit' && <span>Value {formatMoney(summary.endValue, currency)}</span>}
        {targetAmount != null && targetAmount > 0 && (
          <span>
            {Math.round((summary.endValue / targetAmount) * 100)}% of {formatMoney(targetAmount, currency)} target
          </span>
        )}
      </div>
    </div>
  );
}
