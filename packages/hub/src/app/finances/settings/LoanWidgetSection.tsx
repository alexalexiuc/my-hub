'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Card, Divider, IncludeExcludeChip, SectionLabel, SubText } from '@/components';
import { AccountTypes } from '@my-hub/shared/constants';
import type { AccountItem, AccountsListData } from '@/app/api/finances/accounts/route';

export function LoanWidgetSection() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await apiFetch<AccountsListData>('/api/finances/accounts', { silentToast: true });
    setAccounts(result.accounts.filter(a => a.type === AccountTypes.Loan && !a.archived));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(account: AccountItem) {
    await apiFetch(`/api/finances/accounts/${account.id}`, {
      method: 'PATCH',
      body: { action: 'setWidgetVisibility', show: !account.showOnWidget },
      silentToast: true,
    });
    void load();
  }

  if (loading || accounts.length === 0) return null;

  return (
    <Card className="p-[18px]">
      <SectionLabel className="mb-1">Loans shown on widget</SectionLabel>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Flagged loans each get a dedicated card on the finances widget. New or minor loans stay hidden until you opt
        them in.
      </p>
      <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
        {accounts.map((acc, i) => (
          <div key={acc.id}>
            {i > 0 && <Divider />}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className={acc.showOnWidget ? 'text-[var(--green)]' : 'text-[var(--muted)]'}>
                {acc.showOnWidget ? '●' : '○'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[var(--text)]">{acc.name}</div>
                <SubText className="block">{acc.currency}</SubText>
              </div>
              <IncludeExcludeChip included={acc.showOnWidget} onToggle={() => handleToggle(acc)} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
