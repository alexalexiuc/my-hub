'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Divider, TYPE_META, SubText } from '../ui';
import type { NetWorthData } from '@/app/api/finances/networth/route';

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
          <stop offset="0%" stopColor={'var(--green)'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={'var(--green)'} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nwgrad)" />
      <polyline
        points={polyPts}
        fill="none"
        stroke={'var(--green)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={'var(--green)'} />
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
            className="rounded-[10px] border border-[var(--border)] bg-[var(--card)]"
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
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Net Worth</div>

      {/* Main KPI */}
      <div
        className="rounded-[14px] p-5"
        style={{
          background: `linear-gradient(135deg, var(--accent)15, var(--violet)12, var(--card))`,
          border: `1px solid var(--accent)33`,
        }}
      >
        <div className="mb-1.5 text-xs text-[var(--muted)]">Current Net Worth</div>
        <div className="mb-1.5 text-[34px] font-bold tracking-[-0.02em] text-[var(--text)]">
          {fmt(netWorth, currency)}
        </div>
        {deltaVsLastMonth != null && (
          <div className={cn('mb-4 text-xs', deltaVsLastMonth >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]')}>
            {deltaVsLastMonth >= 0 ? '↑' : '↓'} {fmt(Math.abs(deltaVsLastMonth), currency)} vs last month
          </div>
        )}
        {history.length >= 2 ? (
          <>
            <NwChart history={history} width={320} height={100} />
            <div className="mt-1 flex justify-between">
              {history.map(s => (
                <span key={s.month} className="text-[9px] text-[var(--subtle)]">
                  {s.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <SubText className="block">History builds up monthly after the first snapshot.</SubText>
        )}
      </div>

      {/* Assets vs Liabilities summary */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Card compact className="px-[14px] py-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--green)]">Assets</div>
          <div className="text-xl font-bold text-[var(--green)]">{fmt(totalAssets, currency)}</div>
        </Card>
        <Card compact className="px-[14px] py-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--red)]">Liabilities</div>
          <div className="text-xl font-bold text-[var(--red)]">{fmt(totalLiabilities, currency)}</div>
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
                      <div className="text-[13px] text-[var(--text)]">{a.name}</div>
                      <SubText className="block">{meta?.label ?? a.type}</SubText>
                    </div>
                    <div className="text-sm font-semibold text-[var(--text)]">{fmt(a.balance, a.currency)}</div>
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
                      <div className="text-[13px] text-[var(--text)]">{a.name}</div>
                      <SubText className="block">{meta?.label ?? a.type}</SubText>
                    </div>
                    <div className="text-sm font-semibold text-[var(--red)]">-{fmt(a.balance, a.currency)}</div>
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
                  'border-b border-[var(--border)] px-1 pb-2 text-[9px] uppercase tracking-[0.06em] text-[var(--subtle)]',
                  h === 'Month' ? 'text-left' : 'text-right',
                )}
              >
                {h}
              </div>
            ))}
            {history.map((row, i) => {
              const isLatest = i === history.length - 1;
              const cells = [
                <span className="text-[var(--muted)]">{row.label}</span>,
                <span className="tabular-nums text-[var(--green)]">{fmt(row.totalAssets, currency)}</span>,
                <span className="tabular-nums text-[var(--red)]">-{fmt(row.totalLiabilities, currency)}</span>,
                <span className="font-semibold tabular-nums text-[var(--text)]">{fmt(row.netWorth, currency)}</span>,
              ];
              return cells.map((cell, ci) => (
                <div
                  key={`${row.month}-${ci}`}
                  className={cn(
                    'px-1 py-2 text-xs',
                    ci === 0 ? 'text-left' : 'text-right',
                    isLatest ? 'bg-[var(--accent-d)]' : 'bg-transparent',
                  )}
                  style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 13%, transparent)' }}
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
