import { fmt, Bar } from '../ui';

export function AccountProgressBar({
  value,
  max,
  currency,
  color,
  prefix,
}: {
  value: number;
  max: number;
  currency: string;
  color: string;
  prefix?: string;
}) {
  const pct = Math.round((value / max) * 100);

  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-[10px] text-[var(--fin-muted)]">
          {prefix ? `${prefix} ` : ''}
          {fmt(value, currency)} of {fmt(max, currency)}
        </span>
        <span className="text-[10px]" style={{ color }}>
          {pct}%
        </span>
      </div>
      <Bar value={value} max={max} color={color} height={4} />
    </div>
  );
}
