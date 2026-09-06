'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionCard, ProgressBar } from '@/components';
import { EyeOffOutlineIcon, EyeOutlineIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { CategoryIcon, fmt, pct } from './ui';
import type { DashboardResponse, FinanceDashboardData } from '@/app/api/finances/dashboard/route';
import Link from 'next/link';

const HIDDEN = '*** **';

const AVAILABLE_COLOR = 'var(--blue)';
const PORTFOLIO_COLOR = 'var(--green)';
const LOAN_COLOR = 'var(--amber)';

function metricCardStyle(color: string): React.CSSProperties {
  return { background: color + '14', border: `1px solid ${color}33` };
}

export function FinancesWidget() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const revealed = data ? !data.amountsHidden : false;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await apiFetch<DashboardResponse>('/api/finances/dashboard', { silentToast: true });
      if (result.hasBudget) setData(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleRevealed() {
    if (!data) return;
    const amountsHidden = !data.amountsHidden;
    setData({ ...data, amountsHidden });
    await apiFetch('/api/finances/budget', { method: 'PATCH', body: { amountsHidden }, silentToast: true });
  }

  return (
    <div className="finances-theme">
      <SectionCard
        title="Finances"
        titleHref="/finances"
        titleHoverClass="hover:text-violet-400"
        className="border-violet-800/50 bg-gradient-to-br from-violet-950/40 to-zinc-900"
        action={
          data && (
            <button
              onClick={toggleRevealed}
              className="text-zinc-500 hover:text-zinc-300 transition"
              title={revealed ? 'Hide amounts' : 'Show amounts'}
            >
              {revealed ? <EyeOutlineIcon className="size-3.5" /> : <EyeOffOutlineIcon className="size-3.5" />}
            </button>
          )
        }
      >
        {loading ? (
          <div className="grid grid-cols-2 gap-2 mt-2 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-zinc-800" />
            ))}
          </div>
        ) : !data ? (
          <p className="text-sm text-zinc-500 mt-2">
            <Link href="/finances" className="text-violet-400 hover:underline">
              Set up a budget
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <div className="mt-1 flex flex-col gap-2.5">
            {/* Budget bar */}
            {data.budgetTotal > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Budget</span>
                  <span className="tabular-nums text-zinc-300">
                    {revealed
                      ? `${fmt(data.budgetSpent, data.currency)} / ${fmt(data.budgetTotal, data.currency)}`
                      : HIDDEN}
                  </span>
                </div>
                <ProgressBar value={data.budgetSpent} max={data.budgetTotal} height={5} />
                {data.excludedBudgetCategoriesCount > 0 && (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {data.excludedBudgetCategoriesCount} categor{data.excludedBudgetCategoriesCount === 1 ? 'y' : 'ies'}{' '}
                    shown separately, not counted here.
                  </p>
                )}
              </div>
            )}

            {/* Metric grid: Available balance, Portfolio */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/finances/accounts"
                className="rounded-lg p-2.5 transition hover:brightness-125"
                style={metricCardStyle(AVAILABLE_COLOR)}
              >
                <div className="flex items-center gap-1.5">
                  <CategoryIcon color={AVAILABLE_COLOR} size="sm">
                    🏦
                  </CategoryIcon>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">Available</span>
                </div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                  {revealed ? fmt(data.availableBalance, data.currency) : HIDDEN}
                </div>
              </Link>
              <Link
                href="/finances/portfolio"
                className="rounded-lg p-2.5 transition hover:brightness-125"
                style={metricCardStyle(PORTFOLIO_COLOR)}
              >
                <div className="flex items-center gap-1.5">
                  <CategoryIcon color={PORTFOLIO_COLOR} size="sm">
                    📈
                  </CategoryIcon>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">Portfolio</span>
                </div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                  {!data.portfolio || data.portfolio.value === null
                    ? '—'
                    : revealed
                      ? fmt(data.portfolio.value, data.portfolio.currency)
                      : HIDDEN}
                </div>
                {data.portfolio?.returnPct != null && (
                  <div
                    className="text-[10px] tabular-nums"
                    style={{ color: data.portfolio.returnPct >= 0 ? 'var(--green)' : 'var(--red)' }}
                  >
                    {pct(data.portfolio.returnPct, true)}
                  </div>
                )}
              </Link>
            </div>

            {/* Loans — config-driven, 0..N cards */}
            {data.loans.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {data.loans.map(loan => (
                  <Link
                    key={loan.id}
                    href={`/finances/accounts/${loan.id}`}
                    className="rounded-lg p-2.5 transition hover:brightness-125"
                    style={metricCardStyle(LOAN_COLOR)}
                  >
                    <div className="flex items-center gap-1.5">
                      <CategoryIcon color={LOAN_COLOR} size="sm">
                        🏷
                      </CategoryIcon>
                      <span className="truncate text-[10px] uppercase tracking-wide text-zinc-500">{loan.name}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                      {revealed ? fmt(loan.balance, loan.currency) : HIDDEN}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {loan.monthsRemaining} mo left · payoff {loan.payoffDate}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Needs attention — unbudgeted categories with spend this month */}
            {data.needsAttention.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Needs attention</div>
                <div className="space-y-1.5">
                  {data.needsAttention.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon color={cat.color} icon={cat.icon} size="sm" />
                        <span className="text-xs text-zinc-300 truncate">{cat.name}</span>
                      </div>
                      <span className="text-xs tabular-nums ml-2 shrink-0 text-zinc-200">
                        {revealed ? fmt(cat.spent, data.currency) : HIDDEN}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
