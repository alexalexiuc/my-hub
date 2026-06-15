'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Card, SectionLabel, IconButton, DateMode } from '@/components';
import { FunnelIcon } from '@/components/icons';
import { fmt, fmtSign } from '../ui';
import { SmartDatePicker } from '../SmartDatePicker';
import { TransactionFilters } from '../transactions/TransactionFilters';
import type { ExtraFilterValues } from '../transactions/TransactionFilters';
import { SpendingTrendChart } from '../DashboardCharts';
import { CategoryBarChart, PayeeBarChart, CashflowBarChart, SummaryDelta } from './ReportingCharts';
import { AccountCashflowCard } from './AccountCashflowCard';
import { SavingsDebtCard } from './SavingsDebtCard';
import { CategoryGroupCard } from './CategoryGroupCard';
import { SummaryCard } from './SummaryCard';
import { ComparisonTable } from './ComparisonTable';
import type { ReportingData } from '@/app/api/finances/reporting/route';
import type { TransactionType } from '@my-hub/shared/constants';
import { formatMonthStr, shiftMonthStr } from '@my-hub/shared/utils';
import { currentMonthString } from '../finances.utils';
import { useDebounce } from '@/hooks/useDebounce';

type Filter = 'all' | TransactionType;

const EMPTY_EXTRA: ExtraFilterValues = {
  addedByUserId: '',
  accountId: '',
  categoryId: '',
  label: '',
  amountGte: '',
  amountLte: '',
  search: '',
};

export default function ReportingPage() {
  const [dateMode, setDateMode] = useState<DateMode>('month');
  const [month, setMonth] = useState(currentMonthString);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Filter>('all');
  const [extra, setExtra] = useState<ExtraFilterValues>(EMPTY_EXTRA);

  const debouncedSearch = useDebounce(extra.search, 400);
  const debouncedAmountGte = useDebounce(extra.amountGte, 400);
  const debouncedAmountLte = useDebounce(extra.amountLte, 400);

  const [data, setData] = useState<ReportingData | null>(null);
  const [loading, setLoading] = useState(true);

  const activeFilterCount = [
    typeFilter !== 'all',
    dateMode !== 'month',
    !!extra.accountId,
    !!extra.categoryId,
    !!extra.label,
    !!extra.amountGte,
    !!extra.amountLte,
    !!extra.search,
  ].filter(Boolean).length;

  function handleDateChange(patch: { dateMode?: DateMode; month?: string; fromDate?: string; toDate?: string }) {
    if (patch.dateMode !== undefined) setDateMode(patch.dateMode);
    if (patch.month !== undefined) setMonth(patch.month);
    if (patch.dateMode === 'all') {
      setFromDate('');
      setToDate('');
    } else {
      if (patch.fromDate !== undefined) setFromDate(patch.fromDate);
      if (patch.toDate !== undefined) setToDate(patch.toDate);
    }
  }

  useEffect(() => {
    setLoading(true);
    apiFetch<ReportingData>('/api/finances/reporting', {
      silentToast: true,
      query: {
        dateMode,
        month: dateMode === 'month' ? month : undefined,
        fromDate: dateMode === 'range' ? fromDate : undefined,
        toDate: dateMode === 'range' ? toDate : undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        accountId: extra.accountId || undefined,
        categoryId: extra.categoryId || undefined,
        label: extra.label || undefined,
        amountGte: debouncedAmountGte || undefined,
        amountLte: debouncedAmountLte || undefined,
        search: debouncedSearch || undefined,
      },
    })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [
    dateMode,
    month,
    fromDate,
    toDate,
    typeFilter,
    extra.accountId,
    extra.categoryId,
    extra.label,
    debouncedSearch,
    debouncedAmountGte,
    debouncedAmountLte,
  ]);

  const funnelButton = (
    <IconButton
      label="Toggle filters"
      variant="ghost"
      icon={
        <>
          <FunnelIcon className="size-3.5" />
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </>
      }
      onClick={() => setFiltersOpen(o => !o)}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
        filtersOpen || activeFilterCount > 0
          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--text)]',
      )}
    />
  );

  const currency = data?.currency ?? 'EUR';
  const { summary, prevSummary } = data ?? {};

  const periodLabel =
    dateMode === 'month'
      ? month === currentMonthString()
        ? 'This month'
        : formatMonthStr(month)
      : dateMode === 'range'
        ? 'Selected range'
        : 'All time';

  const prevLabel =
    dateMode === 'month' ? formatMonthStr(shiftMonthStr(month, -1)) : dateMode === 'range' ? 'Previous period' : null;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Header */}
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Reporting</div>

      {/* Date + filter controls */}
      <SmartDatePicker
        dateMode={dateMode}
        month={month}
        fromDate={fromDate}
        toDate={toDate}
        currentMonth={currentMonthString()}
        onChange={handleDateChange}
        extendedFilters
        trailing={funnelButton}
      />

      {filtersOpen && (
        <TransactionFilters
          typeFilter={typeFilter}
          extraValues={extra}
          onTypeChange={setTypeFilter}
          onExtraChange={patch => setExtra(prev => ({ ...prev, ...patch }))}
        />
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <SummaryCard
            label="Expenses"
            value={fmt(summary.totalExpenses, currency)}
            delta={
              prevSummary ? (
                <SummaryDelta current={summary.totalExpenses} prev={prevSummary.totalExpenses} lowerIsBetter />
              ) : null
            }
            color="var(--red)"
          />
          <SummaryCard
            label="Income"
            value={fmt(summary.totalIncome, currency)}
            delta={prevSummary ? <SummaryDelta current={summary.totalIncome} prev={prevSummary.totalIncome} /> : null}
            color="var(--green)"
          />
          <SummaryCard
            label="Net"
            value={fmtSign(summary.net, currency)}
            delta={prevSummary ? <SummaryDelta current={summary.net} prev={prevSummary.net} /> : null}
            color={summary.net >= 0 ? 'var(--green)' : 'var(--red)'}
          />
          <SummaryCard
            label="Transactions"
            value={String(summary.transactionCount)}
            delta={
              prevSummary ? (
                <SummaryDelta current={summary.transactionCount} prev={prevSummary.transactionCount} />
              ) : null
            }
            color="var(--accent)"
          />
        </div>
      )}

      {loading && !data && (
        <div className="flex h-32 items-center justify-center text-[13px] text-[var(--muted)]">Loading…</div>
      )}

      {data && (
        <>
          {/* Account income vs spending (shown when an account filter is active) */}
          {data.accountCashflow && <AccountCashflowCard data={data.accountCashflow} periodLabel={periodLabel} />}

          {/* Spending trend (month mode) or Cashflow chart (range/all mode) */}
          {dateMode === 'month' && data.dailySpending && data.dailySpending.length > 0 && (
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <SectionLabel className="mb-0">Spending Trend</SectionLabel>
                <div className="flex items-center gap-2 text-[9px] text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-[2px] w-4 bg-[var(--accent)]" />
                    {periodLabel}
                  </span>
                  {prevLabel && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-[2px] w-4 border-t border-dashed border-[var(--subtle)]" />
                      {prevLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-[200px]">
                <SpendingTrendChart
                  dailySpending={data.dailySpending}
                  currency={data.currency}
                  monthLabel={periodLabel}
                  prevLabel={prevLabel ?? undefined}
                />
              </div>
            </Card>
          )}

          {dateMode !== 'month' && data.cashflowByMonth && data.cashflowByMonth.length > 0 && (
            <Card className="p-[14px]">
              <div className="mb-2 flex justify-between">
                <SectionLabel className="mb-0">Cashflow by Month</SectionLabel>
                <div className="flex items-center gap-2 text-[9px] text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-sm bg-[var(--green)] opacity-75" />
                    Income
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-sm bg-[var(--red)] opacity-75" />
                    Expenses
                  </span>
                </div>
              </div>
              <div className="h-[200px]">
                <CashflowBarChart data={data.cashflowByMonth} currency={data.currency} />
              </div>
            </Card>
          )}

          {/* Category breakdown + Top Payees */}
          {(data.categoryBreakdown.length > 0 || data.topPayees.length > 0) && (
            <div className="grid gap-[14px] md:grid-cols-2">
              {data.categoryBreakdown.length > 0 && (
                <Card className="p-[14px]">
                  <div className="mb-3 flex items-center justify-between">
                    <SectionLabel className="mb-0">By Category</SectionLabel>
                    {prevLabel && <span className="text-[9px] text-[var(--subtle)]">vs {prevLabel}</span>}
                  </div>
                  <CategoryBarChart categories={data.categoryBreakdown} currency={data.currency} />
                </Card>
              )}

              {data.topPayees.length > 0 && (
                <Card className="p-[14px]">
                  <div className="mb-3 flex items-center justify-between">
                    <SectionLabel className="mb-0">Top Payees</SectionLabel>
                    {prevLabel && <span className="text-[9px] text-[var(--subtle)]">vs {prevLabel}</span>}
                  </div>
                  <PayeeBarChart payees={data.topPayees} currency={data.currency} />
                </Card>
              )}
            </div>
          )}

          {/* Savings/Investments/Debt + Category Group breakdown */}
          {(data.savingsDebtFlows.some(f => f.amount > 0 || f.prevAmount > 0) || data.groupBreakdown.length > 0) && (
            <div className="grid gap-[14px] md:grid-cols-2">
              <SavingsDebtCard flows={data.savingsDebtFlows} currency={data.currency} periodLabel={periodLabel} />
              <CategoryGroupCard groups={data.groupBreakdown} currency={data.currency} prevLabel={prevLabel} />
            </div>
          )}

          {/* Category vs Previous — full comparison table */}
          {data.categoryBreakdown.length > 0 && prevSummary && (
            <Card className="p-[14px]">
              <SectionLabel>Period Comparison</SectionLabel>
              <ComparisonTable data={data} currency={currency} periodLabel={periodLabel} prevLabel={prevLabel} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
