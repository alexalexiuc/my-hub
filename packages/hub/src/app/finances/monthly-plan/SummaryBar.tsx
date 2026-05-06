'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components';
import { PencilIcon } from '@/components/icons';
import { Card, Bar, SectionLabel } from '../ui';
import { FinancialDropdown } from '../FinancialDropdown';
import { fmtNum } from './monthly-plan.utils';

type Summary = {
  planned: number;
  remainingPotential: number;
  remainingReal: number;
  assignedCount: number;
  totalCount: number;
};

type SummaryBarProps = {
  availableAmount: number;
  incomeAccountId: number | null;
  summary: Summary;
  accounts: Array<{ id: number; name: string }>;
  onPlanMetaChange: (patch: { availableAmount?: number; incomeAccountId?: number | null }) => Promise<void>;
};

export function SummaryBar({ availableAmount, incomeAccountId, summary, accounts, onPlanMetaChange }: SummaryBarProps) {
  const [editing, setEditing] = useState(false);
  const [editingIncomeAccount, setEditingIncomeAccount] = useState(false);
  const [draft, setDraft] = useState(String(availableAmount));
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const val = parseFloat(draft);
    if (!isNaN(val) && val !== availableAmount) {
      setSaving(true);
      try {
        await onPlanMetaChange({ availableAmount: val });
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  };

  const pct = summary.totalCount > 0 ? Math.round((summary.assignedCount / summary.totalCount) * 100) : 0;
  const selectedIncomeAccountName =
    accounts.find(account => account.id === incomeAccountId)?.name ?? 'No income account';

  return (
    <Card className="mb-5 px-4 py-4 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:gap-x-8 md:gap-y-3">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4 md:flex md:items-start md:gap-8">
            <div>
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--fin-subtle)]">
                Available Funds
                {!editing && (
                  <IconButton
                    label="Edit available funds"
                    icon={<PencilIcon className="size-3" />}
                    onClick={() => {
                      setDraft(String(availableAmount));
                      setEditing(true);
                    }}
                    className="bg-transparent p-0 opacity-50 hover:bg-transparent hover:opacity-100"
                  />
                )}
              </div>
              {editing ? (
                <input
                  autoFocus
                  type="number"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="w-full rounded border border-[var(--fin-accent)] bg-transparent px-2 py-0.5 text-[22px] font-bold text-[var(--fin-text)] tabular-nums focus:outline-none md:w-36 md:text-[26px]"
                />
              ) : (
                <span className="text-[24px] font-bold tabular-nums text-[var(--fin-green)] md:text-[28px]">
                  {saving ? '…' : fmtNum(availableAmount)}
                </span>
              )}
            </div>

            <div className="text-right md:text-left">
              <SectionLabel>Planned</SectionLabel>
              <span className="text-[24px] font-bold tabular-nums text-[var(--fin-text)] md:text-[28px]">
                {fmtNum(summary.planned)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-[var(--fin-muted)]">
            <span className="uppercase tracking-wide">Income account:</span>
            {!editingIncomeAccount ? (
              <>
                <span className="max-w-[180px] truncate text-[13px] text-[var(--fin-text)]">
                  {selectedIncomeAccountName}
                </span>
                <IconButton
                  label="Edit income account"
                  icon={<PencilIcon className="size-3" />}
                  onClick={() => setEditingIncomeAccount(true)}
                  className="bg-transparent p-0 opacity-50 hover:bg-transparent hover:opacity-100"
                />
              </>
            ) : (
              <div className="w-[180px]">
                <FinancialDropdown
                  options={accounts.map(a => ({ id: a.id, value: a.name }))}
                  value={incomeAccountId ?? undefined}
                  onChange={async item => {
                    await onPlanMetaChange({ incomeAccountId: item?.id != null ? Number(item.id) : null });
                    setEditingIncomeAccount(false);
                  }}
                  placeholder="No income account"
                  clearable
                  inputClassName="py-0 text-[13px]"
                  menuClassName="max-h-[160px]"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:ml-auto md:flex md:items-start md:gap-8">
          <div>
            <SectionLabel>Remaining (Potential)</SectionLabel>
            <span
              className={cn(
                'text-[24px] font-bold tabular-nums md:text-[28px]',
                summary.remainingPotential >= 0 ? 'text-[var(--fin-amber)]' : 'text-[var(--fin-red)]',
              )}
            >
              {fmtNum(summary.remainingPotential)}
            </span>
          </div>

          <div className="text-right md:text-left">
            <SectionLabel>Remaining (Real)</SectionLabel>
            <span
              className={cn(
                'text-[24px] font-bold tabular-nums md:text-[28px]',
                summary.remainingReal >= 0 ? 'text-[var(--fin-green)]' : 'text-[var(--fin-red)]',
              )}
            >
              {fmtNum(summary.remainingReal)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] text-[var(--fin-muted)]">
          {summary.assignedCount} of {summary.totalCount} items done · {pct}%
        </div>
        <Bar value={summary.assignedCount} max={Math.max(summary.totalCount, 1)} color="var(--fin-green)" height={4} />
      </div>
    </Card>
  );
}
