'use client';

import { useEffect, useState } from 'react';
import { Divider, Modal, SubText } from '@/components';
import { apiFetch, cn } from '@/lib/utils';
import { CategoryIcon, fmt, TYPE_META } from '../ui';
import { hasAccountActivity } from './cashflow.utils';
import { accountFlowsReportResponseSchema } from '@/app/api/finances/reports/account-flows/account-flows.schema';
import type {
  AccountFlowsReportData,
  MonthlyAccountFlow,
} from '@/app/api/finances/reports/account-flows/account-flows.schema';

type CashflowHelpSheetProps = {
  /** The year currently selected on the page — every explanation is phrased against it. */
  year: number;
  /** Budget default currency, the one the summary cards are labelled with. */
  currency: string;
  onClose: () => void;
};

type HelpSectionProps = {
  title: string;
  /** The one-line formula shown in a monospace strip under the title. */
  formula: string;
  /** One bullet per rule the calculation follows. */
  rules: React.ReactNode[];
  children?: React.ReactNode;
};

function HelpSection({ title, formula, rules, children }: HelpSectionProps) {
  return (
    <div className="mb-5">
      <SubText className="block mb-1.5 font-semibold uppercase tracking-wider">{title}</SubText>
      <div className="mb-2 rounded-[8px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--text)]">
        {formula}
      </div>
      <ul className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-[var(--subtle)]">
        {rules.map((rule, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[var(--muted)]">•</span>
            <span className="min-w-0 flex-1">{rule}</span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

type AccountListProps = {
  accounts: MonthlyAccountFlow[];
  label: string;
  /** Idle accounts are listed by name only — their totals are all zero. */
  muted?: boolean;
};

function AccountList({ accounts, label, muted = false }: AccountListProps) {
  if (!accounts.length) return null;

  return (
    <div className="mt-3">
      <SubText className="block mb-2 font-semibold uppercase tracking-wider">{label}</SubText>
      <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
        {accounts.map((account, i) => {
          const meta = TYPE_META[account.accountType];
          return (
            <div key={account.accountId}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <CategoryIcon color={meta?.color ?? null} size="sm">
                  {meta?.icon ?? '•'}
                </CategoryIcon>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-[13px] font-medium',
                      muted ? 'text-[var(--muted)]' : 'text-[var(--text)]',
                    )}
                  >
                    {account.accountName}
                  </div>
                  <SubText className="block">
                    {meta?.label ?? account.accountType} · {account.currency}
                  </SubText>
                </div>
                {!muted && (
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="text-[12px] text-[var(--green)]">
                      +{fmt(account.totalInflows, account.currency)}
                    </div>
                    <div className="text-[12px] text-[var(--red)]">-{fmt(account.totalOutflows, account.currency)}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Explainer sheet for the Cashflow page: what each view actually sums, which transaction types
 * are in and out of scope, and — for the By Account view — the real accounts behind the numbers,
 * split into the ones that moved money in the selected year and the ones that stayed idle.
 * Loads the same `account-flows` report the By Account view uses so the two never disagree.
 */
export function CashflowHelpSheet({ year, currency, onClose }: CashflowHelpSheetProps) {
  const [data, setData] = useState<AccountFlowsReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/finances/reports/account-flows', {
      query: { year },
      responseSchema: accountFlowsReportResponseSchema,
      silentToast: true,
    })
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the account list');
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const active = data?.accounts.filter(hasAccountActivity) ?? [];
  const idle = data?.accounts.filter(account => !hasAccountActivity(account)) ?? [];

  return (
    <Modal title={`How cashflow is calculated — ${year}`} onClose={onClose} className="md:max-w-[460px]">
      <p className="mb-5 text-[12px] leading-relaxed text-[var(--subtle)]">
        Every figure on this page is computed on read from your transactions dated inside {year} — nothing is stored or
        cached. Balance corrections are excluded from all three views, so a manual balance fix never shows up as income
        or spending.
      </p>

      <HelpSection
        title="Income · Expenses · Net cashflow"
        formula="Net cashflow = Income − Expenses"
        rules={[
          <>
            <strong className="text-[var(--text)]">Income</strong> is the sum of every transaction typed <em>Income</em>{' '}
            dated in {year}.
          </>,
          <>
            <strong className="text-[var(--text)]">Expenses</strong> is the sum of every transaction typed{' '}
            <em>Expense</em> dated in {year}.
          </>,
          <>
            Transfers between your own accounts are never counted here — moving money from one pocket to another is
            neither earning nor spending.
          </>,
          <>
            Every account in the budget contributes,{' '}
            <strong className="text-[var(--text)]">archived ones included</strong> — this total is about the budget, not
            about a specific account.
          </>,
          <>
            Amounts are added up exactly as recorded on each transaction and then shown as {currency}, your
            budget&apos;s default currency. Transactions booked on an account held in another currency are not converted
            here.
          </>,
        ]}
      />

      <HelpSection
        title="Monthly view"
        formula="For each month: In = Income · Out = Expenses · Net = In − Out"
        rules={[
          <>The same two totals as the cards above, split by the calendar month of each transaction&apos;s date.</>,
          <>
            Months with no transactions are shown as zero rather than skipped, so the bar chart and the table always
            cover the full year.
          </>,
          <>Adding up every month&apos;s row reproduces the three cards at the top of the page exactly.</>,
        ]}
      />

      <HelpSection
        title="By Account view"
        formula="Per account, per month: In = Income + transfers in · Out = Expenses + transfers out · Net = In − Out"
        rules={[
          <>
            This is the same in/out decomposition the account detail page shows for the current month, repeated for
            every month of {year}.
          </>,
          <>
            Unlike the cards above, <strong className="text-[var(--text)]">transfers do count</strong> — money arriving
            from another of your accounts is an inflow, money leaving for one is an outflow. That is why an
            account&apos;s totals will not add up to the year&apos;s Income and Expenses.
          </>,
          <>
            Every row is in the <strong className="text-[var(--text)]">account&apos;s own currency</strong>. A transfer
            arriving from an account in a different currency is converted with the exchange rate stored on that
            transfer.
          </>,
          <>
            Archived accounts are left out entirely, and accounts that did not move any money in {year} are hidden to
            keep the list readable.
          </>,
        ]}
      >
        {error ? (
          <div className="mt-3 text-[12px] text-[var(--red)]">{error}</div>
        ) : !data ? (
          <div className="mt-3 h-[72px] rounded-[10px] border border-[var(--border)] bg-[var(--card2)] opacity-50" />
        ) : (
          <>
            <AccountList accounts={active} label={`Shown in ${year} — year totals`} />
            <AccountList accounts={idle} label={`Hidden — no movement in ${year}`} muted />
            {!active.length && !idle.length && (
              <div className="mt-3 py-4 text-center text-[13px] text-[var(--subtle)]">No active accounts yet.</div>
            )}
          </>
        )}
      </HelpSection>

      <HelpSection
        title="By Category view"
        formula="Per category: Spent = Expenses in that category · % of total = Spent ÷ total Expenses"
        rules={[
          <>Expense transactions only — income and transfers never appear in this breakdown.</>,
          <>
            Expenses saved without a category are folded into a single{' '}
            <strong className="text-[var(--text)]">Uncategorised</strong> row rather than dropped.
          </>,
          <>Categories are ordered by spend, highest first, and the bar is drawn relative to the largest category.</>,
        ]}
      />
    </Modal>
  );
}
