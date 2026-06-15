'use client';

import { Card, SectionLabel } from '@/components';
import { SimpleBarChart } from './ReportingCharts';
import type { ReportingGroupItem } from '@/app/api/finances/reporting/route';
import type { SupportedCurrency } from '@my-hub/shared/constants';

type CategoryGroupCardProps = {
  groups: ReportingGroupItem[];
  currency: SupportedCurrency;
  prevLabel: string | null;
};

const GROUP_COLORS = [
  'var(--accent)',
  'var(--blue)',
  'var(--teal)',
  'var(--amber)',
  'var(--violet)',
  'var(--orange)',
  'var(--pink)',
  'var(--emerald)',
  'var(--sky)',
  'var(--green)',
];

export function CategoryGroupCard({ groups, currency, prevLabel }: CategoryGroupCardProps) {
  if (groups.length === 0) return null;

  const items = groups.map((g, i) => ({
    key: g.name,
    name: g.name,
    amount: g.amount,
    prevAmount: g.prevAmount,
    color: g.name === 'Ungrouped' ? 'var(--subtle)' : GROUP_COLORS[i % GROUP_COLORS.length]!,
    trailingStat: `${g.pct}%`,
  }));

  return (
    <Card className="p-[14px]">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel className="mb-0">By Category Group</SectionLabel>
        {prevLabel && <span className="text-[9px] text-[var(--subtle)]">vs {prevLabel}</span>}
      </div>
      <SimpleBarChart items={items} currency={currency} />
    </Card>
  );
}
