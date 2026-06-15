'use client';

import { fmt } from '../ui';
import type { ReportingData } from '@/app/api/finances/reporting/route';

type ComparisonTableProps = {
  data: ReportingData;
  currency: string;
  periodLabel: string;
  prevLabel: string | null;
};

export function ComparisonTable({ data, currency, periodLabel, prevLabel }: ComparisonTableProps) {
  const rows = data.categoryBreakdown.filter(c => c.amount > 0 || c.prevAmount > 0);
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="pb-2 text-left font-medium text-[var(--muted)]">Category</th>
            <th className="pb-2 text-right font-medium text-[var(--muted)]">{periodLabel}</th>
            {prevLabel && <th className="pb-2 text-right font-medium text-[var(--muted)]">{prevLabel}</th>}
            <th className="pb-2 text-right font-medium text-[var(--muted)]">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(cat => {
            const delta = cat.prevAmount > 0 ? ((cat.amount - cat.prevAmount) / cat.prevAmount) * 100 : null;
            const absDelta = cat.amount - cat.prevAmount;
            return (
              <tr key={cat.id} className="border-b border-[var(--border)]/50">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color ?? 'var(--subtle)' }}
                    />
                    <span className="text-[var(--text)]">{cat.name}</span>
                  </div>
                </td>
                <td className="py-2 text-right font-medium text-[var(--text)]">{fmt(cat.amount, currency)}</td>
                {prevLabel && <td className="py-2 text-right text-[var(--muted)]">{fmt(cat.prevAmount, currency)}</td>}
                <td className="py-2 text-right">
                  {delta !== null ? (
                    <span
                      className="font-medium"
                      style={{ color: absDelta > 0 ? 'var(--red)' : absDelta < 0 ? 'var(--green)' : 'var(--muted)' }}
                    >
                      {absDelta > 0 ? '+' : ''}
                      {fmt(absDelta, currency)}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
