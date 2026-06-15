'use client';

import { Card } from '@/components';

type SummaryCardProps = {
  label: string;
  value: string;
  delta: React.ReactNode;
  color: string;
};

export function SummaryCard({ label, value, delta, color }: SummaryCardProps) {
  return (
    <Card className="p-[14px]">
      <div className="mb-1 text-[10px] uppercase tracking-[0.07em] text-[var(--muted)]">{label}</div>
      <div className="text-[18px] font-bold tracking-[-0.02em]" style={{ color }}>
        {value}
      </div>
      {delta && <div className="mt-0.5">{delta}</div>}
    </Card>
  );
}
