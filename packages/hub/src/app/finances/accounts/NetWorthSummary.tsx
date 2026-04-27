import { fmt, Sparkline } from '../ui';

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
        background: `linear-gradient(135deg, var(--fin-accent)18, var(--fin-violet)18)`,
        border: `1px solid var(--fin-accent)33`,
      }}
    >
      <div>
        <div className="mb-1 text-[11px] text-[var(--fin-muted)]">Total Net Worth</div>
        <div className="text-[26px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">{fmt(netWorth, currency)}</div>
      </div>
      <Sparkline data={history} color={'var(--fin-green)'} width={80} height={40} />
    </div>
  );
}
