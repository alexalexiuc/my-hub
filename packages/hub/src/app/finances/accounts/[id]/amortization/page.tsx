'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, cn } from '@/lib/utils';
import { fmt, Card, SectionLabel, Bar } from '../../../ui';
import { LoanPaydownChart } from './LoanPaydownChart';
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
  const paidCount = data.rows.filter(r => r.paid).length;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card)] px-3 py-2.5 md:px-4 md:py-3">
        <div className="min-w-0">
          <SectionLabel className="mb-0">Debt Tracking</SectionLabel>
          <div className="truncate text-base font-bold text-[var(--fin-text)] md:text-lg">{data.name}</div>
        </div>
        <button
          onClick={() => router.push(`/finances/accounts/${id}`)}
          className="shrink-0 cursor-pointer rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-1.5 text-xs font-semibold text-[var(--fin-muted)] hover:border-[var(--fin-accent)] hover:text-[var(--fin-accent)]"
        >
          ← Back
        </button>
      </div>

      {/* Summary card */}
      <div
        className="rounded-xl p-4 md:p-5"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--fin-accent) 12%, transparent), var(--fin-card))',
          border: '1px solid color-mix(in srgb, var(--fin-accent) 20%, transparent)',
        }}
      >
        <SectionLabel className="mb-1">Outstanding Balance</SectionLabel>
        <div className="mb-3 text-[30px] font-bold leading-none text-[var(--fin-red)] md:text-[34px]">
          -{fmt(data.currentBalance, data.currency)}
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Principal', value: fmt(data.principal, data.currency) },
            { label: 'Rate', value: data.interestRate === 0 ? '0% (installment)' : `${data.interestRate}%` },
            { label: 'Monthly', value: fmt(data.monthlyPayment, data.currency) },
            { label: 'Payments', value: `${paidCount}/${data.rows.length}` },
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
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fin-subtle)]">
              Progress
            </span>
            <span className="text-[11px] font-semibold text-[var(--fin-green)]">
              {paidPct}% · {fmt(paidAmount, data.currency)} paid
            </span>
          </div>
          <Bar value={paidAmount} max={data.principal} color="var(--fin-green)" height={6} />
        </div>
      </div>

      {/* Paydown chart */}
      <Card className="p-4 md:p-5">
        <SectionLabel>Balance Curve</SectionLabel>
        <LoanPaydownChart rows={data.rows} principal={data.principal} currency={data.currency} />
      </Card>

      {/* Schedule */}
      <Card className="p-4 md:p-5">
        <SectionLabel>Amortization Schedule</SectionLabel>
        <div data-layout="desktop" className="hidden md:block">
          <div className="grid grid-cols-[36px_1fr_1fr_1fr_1fr_120px] gap-0">
            {['#', 'Date', 'Principal', 'Interest', 'Balance', 'Action'].map(h => (
              <div
                key={h}
                className={cn(
                  'border-b border-[var(--fin-border)] px-2 pb-2 text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]',
                  h === '#' ? 'text-left' : h === 'Action' ? 'text-center' : 'text-right',
                )}
              >
                {h}
              </div>
            ))}

            {data.rows.flatMap(row => {
              const rowBg = row.current ? 'var(--fin-accent-d)' : row.paid ? 'var(--fin-green-d)' : 'transparent';
              const numberLabel = row.paid ? '✓' : String(row.n);
              const numberColor = row.paid
                ? 'text-[var(--fin-green)]'
                : row.current
                  ? 'text-[var(--fin-accent)]'
                  : 'text-[var(--fin-muted)]';

              return [
                <div
                  key={`${row.n}-idx`}
                  className={cn('px-2 py-2.5 text-xs tabular-nums text-left', numberColor)}
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                    background: rowBg,
                  }}
                >
                  {numberLabel}
                </div>,
                <div
                  key={`${row.n}-date`}
                  className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-text)]"
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                    background: rowBg,
                    fontWeight: row.current ? 600 : 400,
                  }}
                >
                  {new Date(row.date).toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })}
                </div>,
                <div
                  key={`${row.n}-principal`}
                  className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-blue)]"
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                    background: rowBg,
                  }}
                >
                  {fmt(row.principalPart, data.currency)}
                </div>,
                <div
                  key={`${row.n}-interest`}
                  className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-muted)]"
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                    background: rowBg,
                  }}
                >
                  {fmt(row.interestPart, data.currency)}
                </div>,
                <div
                  key={`${row.n}-balance`}
                  className="px-2 py-2.5 text-xs tabular-nums text-right text-[var(--fin-text)]"
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                    background: rowBg,
                  }}
                >
                  {fmt(row.balance, data.currency)}
                </div>,
                <div
                  key={`${row.n}-action`}
                  className="px-2 py-2.5 text-center"
                  style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--fin-border) 13%, transparent)',
                    background: rowBg,
                  }}
                >
                  {row.current ? (
                    <button
                      onClick={() => router.push('/finances/transactions/add')}
                      className="cursor-pointer rounded-md border-none bg-[var(--fin-accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--fin-on-solid)] hover:brightness-110"
                    >
                      Mark Paid
                    </button>
                  ) : null}
                </div>,
              ];
            })}
          </div>
        </div>

        <div data-layout="mobile" className="space-y-2 md:hidden">
          {data.rows.map(row => {
            const numberLabel = row.paid ? '✓' : String(row.n);
            const numberColor = row.paid
              ? 'text-[var(--fin-green)]'
              : row.current
                ? 'text-[var(--fin-accent)]'
                : 'text-[var(--fin-muted)]';
            const rowBg = row.current
              ? 'color-mix(in srgb, var(--fin-accent) 14%, transparent)'
              : row.paid
                ? 'color-mix(in srgb, var(--fin-green) 12%, transparent)'
                : 'var(--fin-card2)';

            return (
              <div
                key={row.n}
                className="rounded-lg border border-[var(--fin-border)] px-3 py-2.5"
                style={{ background: rowBg }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className={cn('text-sm font-bold', numberColor)}>Payment {numberLabel}</div>
                  <div className="text-xs text-[var(--fin-muted)]">
                    {new Date(row.date).toLocaleDateString('en-IE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="text-[var(--fin-subtle)]">Principal</div>
                  <div className="text-right font-semibold text-[var(--fin-blue)]">
                    {fmt(row.principalPart, data.currency)}
                  </div>
                  <div className="text-[var(--fin-subtle)]">Interest</div>
                  <div className="text-right text-[var(--fin-muted)]">{fmt(row.interestPart, data.currency)}</div>
                  <div className="text-[var(--fin-subtle)]">Balance</div>
                  <div className="text-right font-semibold text-[var(--fin-text)]">
                    {fmt(row.balance, data.currency)}
                  </div>
                </div>

                {row.current && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => router.push('/finances/transactions/add')}
                      className="cursor-pointer rounded-md border-none bg-[var(--fin-accent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fin-on-solid)] hover:brightness-110"
                    >
                      Mark Paid
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
