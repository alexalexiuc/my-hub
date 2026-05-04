'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Divider, TYPE_META } from '../ui';
import type { NetWorthData } from '@/app/api/finances/contracts';

function NwChart({
  history,
  width = 320,
  height = 100,
}: {
  history: { netWorth: number }[];
  width?: number;
  height?: number;
}) {
  if (history.length < 2) return <div style={{ width, height }} />;
  const nets = history.map(h => h.netWorth);
  const minN = Math.min(...nets),
    maxN = Math.max(...nets);
  const range = maxN - minN || 1;
  const pts = nets.map((v, i) => {
    const x = (i / (nets.length - 1)) * width;
    const y = height - ((v - minN) / range) * (height - 10) - 5;
    return [x, y] as [number, number];
  });
  const polyPts = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `M ${polyPts.split(' ').join(' L ')} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} className="block overflow-visible">
      <defs>
        <linearGradient id="nwgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={'var(--fin-green)'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={'var(--fin-green)'} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nwgrad)" />
      <polyline
        points={polyPts}
        fill="none"
        stroke={'var(--fin-green)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={'var(--fin-green)'} />
      ))}
    </svg>
  );
}

export default function NetWorthPage() {
  const router = useRouter();
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiFetch<NetWorthData>('/api/finances/networth', { silentToast: true });
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[44, 200, 80, 160, 160, 180].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
            style={{ height: h, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { currency, netWorth, totalAssets, totalLiabilities, assets, liabilities, history, deltaVsLastMonth } = data;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Net Worth</div>

      {/* Main KPI */}
      <div
        className="rounded-[14px] p-5"
        style={{
          background: `linear-gradient(135deg, var(--fin-accent)15, var(--fin-violet)12, var(--fin-card))`,
          border: `1px solid var(--fin-accent)33`,
        }}
      >
        <div className="mb-1.5 text-xs text-[var(--fin-muted)]">Current Net Worth</div>
        <div className="mb-1.5 text-[34px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">
          {fmt(netWorth, currency)}
        </div>
        {deltaVsLastMonth != null && (
          <div
            className={cn('mb-4 text-xs', deltaVsLastMonth >= 0 ? 'text-[var(--fin-green)]' : 'text-[var(--fin-red)]')}
          >
            {deltaVsLastMonth >= 0 ? '↑' : '↓'} {fmt(Math.abs(deltaVsLastMonth), currency)} vs last month
          </div>
        )}
        {history.length >= 2 ? (
          <>
            <NwChart history={history} width={320} height={100} />
            <div className="mt-1 flex justify-between">
              {history.map(s => (
                <span key={s.month} className="text-[9px] text-[var(--fin-subtle)]">
                  {s.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-[11px] text-[var(--fin-subtle)]">
            History builds up monthly after the first snapshot.
          </div>
        )}
      </div>

      {/* Assets vs Liabilities summary */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Card className="px-[14px] py-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-green)]">Assets</div>
          <div className="text-xl font-bold text-[var(--fin-green)]">{fmt(totalAssets, currency)}</div>
        </Card>
        <Card className="px-[14px] py-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-red)]">Liabilities</div>
          <div className="text-xl font-bold text-[var(--fin-red)]">{fmt(totalLiabilities, currency)}</div>
        </Card>
      </div>

      {/* Asset accounts */}
      {assets.length > 0 && (
        <div>
          <SectionLabel>Assets</SectionLabel>
          <Card className="py-[6px]">
            {assets.map((a, i) => {
              const meta = TYPE_META[a.type];
              return (
                <div key={a.id}>
                  {i > 0 && <Divider />}
                  <div
                    onClick={() => router.push(`/finances/accounts/${a.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 px-[14px] py-[10px]"
                  >
                    <span className="text-base">{meta?.icon ?? '•'}</span>
                    <div className="flex-1">
                      <div className="text-[13px] text-[var(--fin-text)]">{a.name}</div>
                      <div className="text-[10px] text-[var(--fin-subtle)]">{meta?.label ?? a.type}</div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--fin-text)]">{fmt(a.balance, a.currency)}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Liability accounts */}
      {liabilities.length > 0 && (
        <div>
          <SectionLabel>Liabilities</SectionLabel>
          <Card className="py-[6px]">
            {liabilities.map((a, i) => {
              const meta = TYPE_META[a.type];
              return (
                <div key={a.id}>
                  {i > 0 && <Divider />}
                  <div
                    onClick={() => router.push(`/finances/accounts/${a.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 px-[14px] py-[10px]"
                  >
                    <span className="text-base">{meta?.icon ?? '•'}</span>
                    <div className="flex-1">
                      <div className="text-[13px] text-[var(--fin-text)]">{a.name}</div>
                      <div className="text-[10px] text-[var(--fin-subtle)]">{meta?.label ?? a.type}</div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--fin-red)]">-{fmt(a.balance, a.currency)}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Monthly snapshots table */}
      {history.length > 0 && (
        <Card className="p-[14px]">
          <SectionLabel>Monthly Snapshots</SectionLabel>
          <div className="grid grid-cols-4 gap-0">
            {['Month', 'Assets', 'Liab.', 'Net'].map(h => (
              <div
                key={h}
                className={cn(
                  'border-b border-[var(--fin-border)] px-1 pb-2 text-[9px] uppercase tracking-[0.06em] text-[var(--fin-subtle)]',
                  h === 'Month' ? 'text-left' : 'text-right',
                )}
              >
                {h}
              </div>
            ))}
            {history.map((row, i) => {
              const isLatest = i === history.length - 1;
              const cells = [
                <span className="text-[var(--fin-muted)]">{row.label}</span>,
                <span className="tabular-nums text-[var(--fin-green)]">{fmt(row.totalAssets, currency)}</span>,
                <span className="tabular-nums text-[var(--fin-red)]">-{fmt(row.totalLiabilities, currency)}</span>,
                <span className="font-semibold tabular-nums text-[var(--fin-text)]">
                  {fmt(row.netWorth, currency)}
                </span>,
              ];
              return cells.map((cell, ci) => (
                <div
                  key={`${row.month}-${ci}`}
                  className={cn(
                    'px-1 py-2 text-xs',
                    ci === 0 ? 'text-left' : 'text-right',
                    isLatest ? 'bg-[var(--fin-accent-d)]' : 'bg-transparent',
                  )}
                  style={{ borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)' }}
                >
                  {cell}
                </div>
              ));
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
