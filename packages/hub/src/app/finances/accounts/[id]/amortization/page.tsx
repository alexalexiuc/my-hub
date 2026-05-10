'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar } from '../../../ui';
import { LoanPaydownChart } from './LoanPaydownChart';
import type { AmortizationData } from '@/app/api/finances/contracts';

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
      <div className="flex flex-col gap-[14px]">
        {[44, 160, 72, 320].map((h, i) => (
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

  const paidAmount = data.principal - data.currentBalance;
  const paidPct = data.principal > 0 ? Math.round((paidAmount / data.principal) * 100) : 0;
  const nextRow = data.rows.find(r => r.current);
  const nextDue = nextRow?.date
    ? new Date(nextRow.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => router.push(`/finances/accounts/${id}`)}
          className="cursor-pointer rounded-md border border-[var(--fin-border)] bg-transparent px-2.5 py-[5px] text-xs text-[var(--fin-muted)]"
        >
          ← Back
        </button>
        <div className="text-lg font-bold text-[var(--fin-text)]">Loan Schedule</div>
      </div>

      {/* Summary card */}
      <div
        className="rounded-xl p-4"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--fin-accent) 12%, transparent), var(--fin-card))',
          border: '1px solid color-mix(in srgb, var(--fin-accent) 20%, transparent)',
        }}
      >
        <div className="mb-1 text-[13px] text-[var(--fin-muted)]">{data.name}</div>
        <div className="mb-2 text-[28px] font-bold text-[var(--fin-red)]">
          -{fmt(data.currentBalance, data.currency)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Principal', value: fmt(data.principal, data.currency) },
            { label: 'Rate', value: data.interestRate === 0 ? '0% (installment)' : `${data.interestRate}%` },
            { label: 'Monthly', value: fmt(data.monthlyPayment, data.currency) },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-md px-2.5 py-2"
              style={{ background: 'color-mix(in srgb, var(--fin-card2) 53%, transparent)' }}
            >
              <div className="mb-[3px] text-[9px] uppercase tracking-[0.06em] text-[var(--fin-subtle)]">{s.label}</div>
              <div className="text-sm font-semibold text-[var(--fin-text)]">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between">
            <span className="text-[10px] text-[var(--fin-subtle)]">Paid off</span>
            <span className="text-[10px] text-[var(--fin-green)]">
              {paidPct}% · {fmt(paidAmount, data.currency)} paid
            </span>
          </div>
          <Bar value={paidAmount} max={data.principal} color="var(--fin-green)" height={6} />
        </div>
      </div>

      {/* Next payment banner */}
      {nextRow && (
        <div
          className="flex items-center justify-between rounded-[10px] border px-[14px] py-3"
          style={{
            background: 'var(--fin-amber-d)',
            borderColor: 'color-mix(in srgb, var(--fin-amber) 27%, transparent)',
          }}
        >
          <div>
            <div className="mb-0.5 text-[11px] font-semibold text-[var(--fin-amber)]">Next Payment</div>
            <div className="text-[15px] font-bold text-[var(--fin-text)]">
              {fmt(data.monthlyPayment, data.currency)}
            </div>
            {nextDue && <div className="text-[11px] text-[var(--fin-muted)]">Due {nextDue}</div>}
          </div>
          <button
            onClick={() => router.push('/finances/transactions/add')}
            className="cursor-pointer rounded-lg border-none bg-[var(--fin-accent)] px-[14px] py-2 text-xs font-semibold text-[var(--fin-on-solid)]"
          >
            Mark Paid
          </button>
        </div>
      )}

      {/* Paydown chart */}
      <Card className="p-[14px]">
        <LoanPaydownChart rows={data.rows} principal={data.principal} currency={data.currency} />
      </Card>

      {/* Schedule table */}
      <Card className="p-[14px]">
        <SectionLabel>Amortization Schedule</SectionLabel>
        <div className="grid grid-cols-[28px_1fr_1fr_1fr_1fr] gap-0">
          {['#', 'Date', 'Principal', 'Interest', 'Balance'].map(h => (
            <div
              key={h}
              className="border-b border-[var(--fin-border)] px-1 pb-2 text-[9px] uppercase tracking-[0.06em] text-[var(--fin-subtle)]"
              style={{
                textAlign: h === '#' ? 'left' : 'right',
              }}
            >
              {h}
            </div>
          ))}

          {data.rows.map(row => {
            const rowBg = row.current ? 'var(--fin-accent-d)' : row.paid ? 'var(--fin-green-d)' : 'transparent';
            const cells = [
              <span
                style={{
                  color: row.paid ? 'var(--fin-green)' : row.current ? 'var(--fin-accent)' : 'var(--fin-muted)',
                }}
              >
                {row.paid ? '✓' : row.n}
              </span>,
              <span style={{ color: 'var(--fin-text)', fontWeight: row.current ? 600 : 400 }}>
                {new Date(row.date).toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })}
              </span>,
              <span style={{ color: 'var(--fin-blue)' }}>{fmt(row.principalPart, data.currency)}</span>,
              <span style={{ color: 'var(--fin-muted)' }}>{fmt(row.interestPart, data.currency)}</span>,
              <span style={{ color: 'var(--fin-text)' }}>{fmt(row.balance, data.currency)}</span>,
            ];

            return cells.map((cell, ci) => (
              <div
                key={`${row.n}-${ci}`}
                className="px-1 py-2 text-xs tabular-nums"
                style={{
                  borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                  textAlign: ci === 0 ? 'left' : 'right',
                  background: rowBg,
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
