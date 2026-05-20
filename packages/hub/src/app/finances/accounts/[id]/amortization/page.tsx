'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, cn } from '@/lib/utils';
import { fmt, Card, SectionLabel, SubText } from '../../../ui';
import { LoanPaydownChart } from './LoanPaydownChart';
import type { AmortizationData } from '@/app/api/finances/accounts/[id]/amortization/route';

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' });
}

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
        {[44, 180, 72, 320].map((h, i) => (
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

  const hasInterest = data.interestRate > 0;
  const nextRow = data.rows.find(r => r.next);
  const pastCount = data.rows.filter(r => r.past).length;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card)] px-3 py-2.5 md:px-4 md:py-3">
        <div className="min-w-0">
          <SectionLabel className="mb-0">Amortization Schedule</SectionLabel>
          <div className="truncate text-base font-bold text-[var(--fin-text)] md:text-lg">{data.name}</div>
        </div>
        <button
          onClick={() => router.push(`/finances/accounts/${id}`)}
          className="shrink-0 cursor-pointer rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-1.5 text-xs font-semibold text-[var(--fin-muted)] hover:border-[var(--fin-accent)] hover:text-[var(--fin-accent)]"
        >
          ← Back
        </button>
      </div>

      {/* Summary */}
      <div
        className="rounded-xl p-4 md:p-5"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--fin-accent) 12%, transparent), var(--fin-card))',
          border: '1px solid color-mix(in srgb, var(--fin-accent) 20%, transparent)',
        }}
      >
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Principal', value: fmt(data.principal, data.currency) },
            { label: 'Rate', value: data.interestRate === 0 ? '0% (installment)' : `${data.interestRate}%` },
            { label: 'Monthly', value: fmt(data.monthlyPayment, data.currency) },
            {
              label: hasInterest ? 'Total interest' : 'Total cost',
              value: fmt(hasInterest ? data.totalInterest : data.totalCost, data.currency),
            },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-lg px-3 py-2.5"
              style={{ background: 'color-mix(in srgb, var(--fin-card2) 53%, transparent)' }}
            >
              <div className="mb-1 text-[9px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">{s.label}</div>
              <div className="text-[13px] font-semibold text-[var(--fin-text)]">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[var(--fin-muted)]">
          <span>
            {fmtDate(data.startDate)} → {fmtDate(data.payoffDate)}
          </span>
          <span>·</span>
          <span>{data.termMonths} payments</span>
          {nextRow && (
            <>
              <span>·</span>
              <span>
                Next due <span className="text-[var(--fin-text)]">{fmtDate(nextRow.date)}</span>
              </span>
            </>
          )}
          {pastCount > 0 && (
            <>
              <span>·</span>
              <span className="text-[var(--fin-subtle)]">
                {pastCount}/{data.termMonths} past due dates
              </span>
            </>
          )}
        </div>

        <div className="mt-3 text-[10px] text-[var(--fin-subtle)]">
          Simulation based on loan parameters — actual balance depends on payments recorded.
        </div>
      </div>

      {/* Chart */}
      <Card className="p-4 md:p-5">
        <SectionLabel className="mb-3">Balance Curve</SectionLabel>
        <LoanPaydownChart
          rows={data.rows}
          principal={data.principal}
          currency={data.currency}
          nextPaymentDate={nextRow?.date}
        />
      </Card>

      {/* Schedule table */}
      <Card className="p-4 md:p-5">
        <SectionLabel>Schedule</SectionLabel>

        {/* Desktop */}
        <div data-layout="desktop" className="hidden md:block">
          <div
            className={cn(
              'grid gap-0',
              hasInterest ? 'grid-cols-[32px_1fr_1fr_1fr_1fr]' : 'grid-cols-[32px_1fr_1fr_1fr]',
            )}
          >
            {['', 'Date', ...(hasInterest ? ['Principal', 'Interest'] : ['Principal']), 'Remaining'].map((h, i) => (
              <div
                key={i}
                className={cn(
                  'border-b border-[var(--fin-border)] px-2 pb-2 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]',
                  i === 0 ? 'text-center' : 'text-right',
                )}
              >
                {h}
              </div>
            ))}

            {data.rows.flatMap(row => {
              const rowBg = row.next ? 'var(--fin-accent-d)' : row.past ? 'var(--fin-green-d)' : 'transparent';
              const cell = {
                borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                background: rowBg,
              };

              return [
                <div key={`${row.n}-s`} className="px-2 py-2.5 text-center text-xs" style={cell}>
                  {row.past ? (
                    <span className="text-[var(--fin-green)]">✓</span>
                  ) : row.next ? (
                    <span className="font-bold text-[var(--fin-accent)]">→</span>
                  ) : (
                    <span className="text-[var(--fin-subtle)]">{row.n}</span>
                  )}
                </div>,
                <div
                  key={`${row.n}-d`}
                  className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-text)]"
                  style={{ ...cell, fontWeight: row.next ? 600 : 400 }}
                >
                  {new Date(row.date).toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })}
                </div>,
                ...(hasInterest
                  ? [
                      <div
                        key={`${row.n}-p`}
                        className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-blue)]"
                        style={cell}
                      >
                        {fmt(row.principalPart, data.currency)}
                      </div>,
                      <div
                        key={`${row.n}-i`}
                        className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-muted)]"
                        style={cell}
                      >
                        {fmt(row.interestPart, data.currency)}
                      </div>,
                    ]
                  : [
                      <div
                        key={`${row.n}-p`}
                        className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-blue)]"
                        style={cell}
                      >
                        {fmt(row.principalPart, data.currency)}
                      </div>,
                    ]),
                <div
                  key={`${row.n}-b`}
                  className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-text)]"
                  style={cell}
                >
                  {fmt(row.balance, data.currency)}
                </div>,
              ];
            })}
          </div>
        </div>

        {/* Mobile */}
        <div data-layout="mobile" className="space-y-2 md:hidden">
          {data.rows.map(row => (
            <div
              key={row.n}
              className="rounded-lg border border-[var(--fin-border)] px-3 py-2.5"
              style={{
                background: row.next
                  ? 'color-mix(in srgb, var(--fin-accent) 14%, transparent)'
                  : row.past
                    ? 'color-mix(in srgb, var(--fin-green) 12%, transparent)'
                    : 'var(--fin-card2)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div
                  className={cn(
                    'text-sm font-bold',
                    row.past
                      ? 'text-[var(--fin-green)]'
                      : row.next
                        ? 'text-[var(--fin-accent)]'
                        : 'text-[var(--fin-subtle)]',
                  )}
                >
                  {row.past ? '✓' : row.next ? '→' : `#${row.n}`}
                </div>
                <SubText>
                  {new Date(row.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </SubText>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div className="text-[var(--fin-subtle)]">Principal</div>
                <div className="text-right font-semibold text-[var(--fin-blue)]">
                  {fmt(row.principalPart, data.currency)}
                </div>
                {hasInterest && (
                  <>
                    <div className="text-[var(--fin-subtle)]">Interest</div>
                    <div className="text-right text-[var(--fin-muted)]">{fmt(row.interestPart, data.currency)}</div>
                  </>
                )}
                <div className="text-[var(--fin-subtle)]">Remaining</div>
                <div className="text-right font-semibold text-[var(--fin-text)]">{fmt(row.balance, data.currency)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
