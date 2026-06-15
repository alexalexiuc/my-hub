'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { fmt, tooltipBoxStyle } from '../ui';
import type { PortfolioHistoryPoint } from '@my-hub/shared/services';
import type { PortfolioHistoryResponse } from '@/app/api/finances/portfolio/history/route';

type HistoryModalProps = {
  currency: string;
  onClose: () => void;
};

export function HistoryModal({ currency, onClose }: HistoryModalProps) {
  const [points, setPoints] = useState<PortfolioHistoryPoint[] | null>(null);

  useEffect(() => {
    apiFetch<PortfolioHistoryResponse>('/api/finances/portfolio/history', { silentToast: true })
      .then(res => setPoints(res.points))
      .catch(() => setPoints([]));
  }, []);

  return (
    <FinModalShell onClose={onClose} title="Portfolio Value" className="md:max-w-[720px]">
      <div className="mb-2 flex items-center justify-end gap-2 text-[9px] text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-[var(--accent)]" />
          Value
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 border-t border-dashed border-[var(--subtle)]" />
          Invested
        </span>
      </div>

      {points === null && (
        <div className="flex h-[260px] items-center justify-center text-[13px] text-[var(--muted)]">Loading…</div>
      )}
      {points !== null && points.length === 0 && (
        <div className="flex h-[260px] items-center justify-center text-[13px] text-[var(--muted)]">
          No history yet — record a supply first.
        </div>
      )}

      {points !== null && points.length > 0 && (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--subtle)', fontSize: 9 }}
                interval="preserveStartEnd"
                minTickGap={48}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div style={tooltipBoxStyle}>
                      <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 4 }}>{label}</div>
                      {payload.map((p, i) => (
                        <div key={i} style={{ color: p.color as string, marginBottom: 2 }}>
                          {p.name === 'value' ? 'Value' : 'Invested'}:{' '}
                          {typeof p.value === 'number' ? fmt(p.value, currency) : String(p.value)}
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="var(--subtle)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3, fill: 'var(--subtle)', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </FinModalShell>
  );
}
