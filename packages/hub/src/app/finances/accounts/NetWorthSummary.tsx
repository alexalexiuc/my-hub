import { Sparkline } from '@/components';
import { fmt } from '../ui';

export function NetWorthSummary({
  netWorth,
  currency,
  history,
}: {
  netWorth: number;
  currency: string;
  history: number[];
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl p-4"
      style={{
        background: `linear-gradient(135deg, var(--accent)18, var(--violet)18)`,
        border: `1px solid var(--accent)33`,
      }}
    >
      <div>
        <div className="mb-1 text-[11px] text-[var(--muted)]">Total Net Worth</div>
        <div className="text-[26px] font-bold tracking-[-0.02em] text-[var(--text)]">{fmt(netWorth, currency)}</div>
      </div>
      <Sparkline data={history} color={'var(--green)'} width={80} height={40} />
    </div>
  );
}
