'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { T, fmt, Card, SectionLabel, Bar } from '../../../ui';
import type { AmortizationData } from '@/app/api/finances/accounts/[id]/amortization/route';

export default function AmortizationPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AmortizationData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiFetch<AmortizationData>(`/api/finances/accounts/${id}/amortization`, { silentToast: true });
    setData(result);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[44, 160, 72, 320].map((h, i) => (
          <div
            key={i}
            style={{ height: h, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const paidAmount = data.principal - data.currentBalance;
  const paidPct = data.principal > 0 ? Math.round((paidAmount / data.principal) * 100) : 0;
  const nextRow = data.rows.find(r => r.current);
  const nextDue = nextRow?.date
    ? new Date(nextRow.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => router.push(`/finances/accounts/${id}`)}
          style={{
            background: 'transparent',
            border: `1px solid ${T.border}`,
            color: T.muted,
            padding: '5px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Loan Schedule</div>
      </div>

      {/* Summary card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.accent}18, ${T.card})`,
          border: `1px solid ${T.accent}33`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>{data.name}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.red, marginBottom: 8 }}>
          -{fmt(data.currentBalance, data.currency)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Principal', value: fmt(data.principal, data.currency) },
            { label: 'Rate', value: data.interestRate === 0 ? '0% (installment)' : `${data.interestRate}%` },
            { label: 'Monthly', value: fmt(data.monthlyPayment, data.currency) },
          ].map(s => (
            <div key={s.label} style={{ background: T.card2 + '88', borderRadius: 6, padding: '8px 10px' }}>
              <div
                style={{
                  fontSize: 9,
                  color: T.subtle,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  marginBottom: 3,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.subtle }}>Paid off</span>
            <span style={{ fontSize: 10, color: T.green }}>
              {paidPct}% · {fmt(paidAmount, data.currency)} paid
            </span>
          </div>
          <Bar value={paidAmount} max={data.principal} color={T.green} height={6} />
        </div>
      </div>

      {/* Next payment banner */}
      {nextRow && (
        <div
          style={{
            background: T.amberD,
            border: `1px solid ${T.amber}44`,
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: T.amber, fontWeight: 600, marginBottom: 2 }}>Next Payment</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              {fmt(data.monthlyPayment, data.currency)}
            </div>
            {nextDue && <div style={{ fontSize: 11, color: T.muted }}>Due {nextDue}</div>}
          </div>
          <button
            onClick={() => router.push('/finances/transactions/add')}
            style={{
              background: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Mark Paid
          </button>
        </div>
      )}

      {/* Schedule table */}
      <Card style={{ padding: 14 }}>
        <SectionLabel>Amortization Schedule</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr 1fr', gap: 0 }}>
          {['#', 'Date', 'Principal', 'Interest', 'Balance'].map(h => (
            <div
              key={h}
              style={{
                fontSize: 9,
                color: T.subtle,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                padding: '0 4px 8px',
                borderBottom: `1px solid ${T.border}`,
                textAlign: h === '#' ? 'left' : 'right',
              }}
            >
              {h}
            </div>
          ))}

          {data.rows.map(row => {
            const rowBg = row.current ? T.accentD : row.paid ? T.greenD : 'transparent';
            const cells = [
              <span style={{ color: row.paid ? T.green : row.current ? T.accent : T.muted }}>
                {row.paid ? '✓' : row.n}
              </span>,
              <span style={{ color: T.text, fontWeight: row.current ? 600 : 400 }}>
                {new Date(row.date).toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })}
              </span>,
              <span style={{ color: T.blue }}>{fmt(row.principalPart, data.currency)}</span>,
              <span style={{ color: T.muted }}>{fmt(row.interestPart, data.currency)}</span>,
              <span style={{ color: T.text }}>{fmt(row.balance, data.currency)}</span>,
            ];

            return cells.map((cell, ci) => (
              <div
                key={`${row.n}-${ci}`}
                style={{
                  fontSize: 12,
                  padding: '8px 4px',
                  borderBottom: `1px solid ${T.border}22`,
                  textAlign: ci === 0 ? 'left' : 'right',
                  background: rowBg,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {cell}
              </div>
            ));
          })}
        </div>
      </Card>
    </div>
  );
}
