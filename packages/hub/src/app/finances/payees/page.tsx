'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, Divider, CategoryIcon } from '../ui';
import type { PayeeReportItem } from '@/app/api/finances/payees/report/route';

interface PayeesData {
  currency: string;
  payees: PayeeReportItem[];
}
type Range = '30d' | '3m' | 'ytd';
type SortKey = 'totalSpent' | 'txCount' | 'name';

const RANGES: { key: Range; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'ytd', label: 'This year' },
];

export default function PayeesPage() {
  const [range, setRange] = useState<Range>('30d');
  const [sortBy, setSortBy] = useState<SortKey>('totalSpent');
  const [data, setData] = useState<PayeesData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const result = await apiFetch<PayeesData>(`/api/finances/payees/report?range=${r}`, { silentToast: true });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const currency = data?.currency ?? 'EUR';
  const sorted = [...(data?.payees ?? [])].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b[sortBy] - a[sortBy];
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text }}>Payees</div>

      {/* Range filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {RANGES.map(({ key, label }) => {
          const active = range === key;
          return (
            <button
              key={key}
              onClick={() => setRange(key)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 11,
                cursor: 'pointer',
                background: active ? T.accentD : T.card2,
                border: active ? `1px solid ${T.accent}44` : `1px solid ${T.border}`,
                color: active ? T.accent : T.muted,
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          style={{ height: 300, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
        />
      ) : (
        <Card style={{ padding: 0 }}>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 90px',
              padding: '10px 14px',
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {(
              [
                ['name', 'Payee'],
                ['txCount', 'Txns'],
                ['totalSpent', 'Total'],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <div
                key={key}
                onClick={() => setSortBy(key)}
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  color: sortBy === key ? T.accent : T.subtle,
                  fontWeight: sortBy === key ? 700 : 400,
                  textAlign: key === 'name' ? 'left' : 'right',
                }}
              >
                {label} {sortBy === key && '↓'}
              </div>
            ))}
          </div>

          {sorted.length === 0 && (
            <div style={{ fontSize: 12, color: T.subtle, textAlign: 'center', padding: '32px 0' }}>
              No payee data for this period
            </div>
          )}

          {sorted.map((p, i) => {
            const catColor = p.categoryColor ?? T.muted;
            return (
              <div key={p.id}>
                {i > 0 && <Divider />}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 90px',
                    padding: '10px 14px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CategoryIcon color={catColor} icon={p.categoryIcon} size="lg" />
                    <div>
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: T.subtle }}>
                        {p.categoryName ? `${p.categoryName} · ` : ''}Last: {p.lastDate}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {p.txCount}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.text,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(p.totalSpent, currency)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
