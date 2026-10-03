type VacationStatProps = {
  label: string;
  value: string;
  tone?: 'gain' | 'loss';
};

/** One label/value pair of a vacation totals grid; `tone` colours gains green and losses red. */
export function VacationStat({ label, value, tone }: VacationStatProps) {
  const color = tone === 'gain' ? 'text-[var(--green)]' : tone === 'loss' ? 'text-[var(--red)]' : '';
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className={`font-medium tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
