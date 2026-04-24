'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Divider, TYPE_META } from '../ui';
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
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="nwgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.green} stopOpacity="0.3" />
          <stop offset="100%" stopColor={T.green} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nwgrad)" />
      <polyline
        points={polyPts}
        fill="none"
        stroke={T.green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={T.green} />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[44, 200, 80, 160, 160, 180].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { currency, netWorth, totalAssets, totalLiabilities, assets, liabilities, history, deltaVsLastMonth } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Net Worth</div>

      {/* Main KPI */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.accent}15, ${T.violet}12, ${T.card})`,
          border: `1px solid ${T.accent}33`,
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Current Net Worth</div>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.02em', color: T.text, marginBottom: 6 }}>
          {fmt(netWorth, currency)}
        </div>
        {deltaVsLastMonth != null && (
          <div style={{ fontSize: 12, color: deltaVsLastMonth >= 0 ? T.green : T.red, marginBottom: 16 }}>
            {deltaVsLastMonth >= 0 ? '↑' : '↓'} {fmt(Math.abs(deltaVsLastMonth), currency)} vs last month
          </div>
        )}
        {history.length >= 2 ? (
          <>
            <NwChart history={history} width={320} height={100} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {history.map(s => (
                <span key={s.month} style={{ fontSize: 9, color: T.subtle }}>
                  {s.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: T.subtle }}>History builds up monthly after the first snapshot.</div>
        )}
      </div>

      {/* Assets vs Liabilities summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Card style={{ padding: '12px 14px' }}>
          <div
            style={{
              fontSize: 10,
              color: T.green,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 4,
            }}
          >
            Assets
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.green }}>{fmt(totalAssets, currency)}</div>
        </Card>
        <Card style={{ padding: '12px 14px' }}>
          <div
            style={{ fontSize: 10, color: T.red, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}
          >
            Liabilities
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.red }}>{fmt(totalLiabilities, currency)}</div>
        </Card>
      </div>

      {/* Asset accounts */}
      {assets.length > 0 && (
        <div>
          <SectionLabel>Assets</SectionLabel>
          <Card style={{ padding: '6px 0' }}>
            {assets.map((a, i) => {
              const meta = TYPE_META[a.type];
              return (
                <div key={a.id}>
                  {i > 0 && <Divider />}
                  <div
                    onClick={() => router.push(`/finances/accounts/${a.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 16 }}>{meta?.icon ?? '•'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.text }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: T.subtle }}>{meta?.label ?? a.type}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{fmt(a.balance, a.currency)}</div>
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
          <Card style={{ padding: '6px 0' }}>
            {liabilities.map((a, i) => {
              const meta = TYPE_META[a.type];
              return (
                <div key={a.id}>
                  {i > 0 && <Divider />}
                  <div
                    onClick={() => router.push(`/finances/accounts/${a.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 16 }}>{meta?.icon ?? '•'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.text }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: T.subtle }}>{meta?.label ?? a.type}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.red }}>-{fmt(a.balance, a.currency)}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Monthly snapshots table */}
      {history.length > 0 && (
        <Card style={{ padding: 14 }}>
          <SectionLabel>Monthly Snapshots</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0 }}>
            {['Month', 'Assets', 'Liab.', 'Net'].map(h => (
              <div
                key={h}
                style={{
                  fontSize: 9,
                  color: T.subtle,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  padding: '0 4px 8px',
                  borderBottom: `1px solid ${T.border}`,
                  textAlign: h === 'Month' ? 'left' : 'right',
                }}
              >
                {h}
              </div>
            ))}
            {history.map((row, i) => {
              const isLatest = i === history.length - 1;
              const cells = [
                <span style={{ color: T.muted }}>{row.label}</span>,
                <span style={{ color: T.green, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(row.totalAssets, currency)}
                </span>,
                <span style={{ color: T.red, fontVariantNumeric: 'tabular-nums' }}>
                  -{fmt(row.totalLiabilities, currency)}
                </span>,
                <span style={{ fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(row.netWorth, currency)}
                </span>,
              ];
              return cells.map((cell, ci) => (
                <div
                  key={`${row.month}-${ci}`}
                  style={{
                    fontSize: 12,
                    padding: '8px 4px',
                    borderBottom: `1px solid ${T.border}22`,
                    textAlign: ci === 0 ? 'left' : 'right',
                    background: isLatest ? T.accentD : 'transparent',
                  }}
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
