'use client';

import { fmt, Divider, AmountText } from '../ui';
import { FinModalShell } from '../FinModalShell';
import { ACCOUNT_TYPE_NAMES, LIABILITY_ACCOUNT_TYPES } from '@my-hub/shared/constants';
import type { AccountType } from '@my-hub/shared/constants';
import type { AccountItem } from '@/app/api/finances/accounts/route';

type NetWorthSheetProps = {
  accounts: AccountItem[];
  netWorth: number;
  currency: string;
  onClose: () => void;
};

export function NetWorthSheet({ accounts, netWorth, currency, onClose }: NetWorthSheetProps) {
  const assets = accounts.filter(a => !LIABILITY_ACCOUNT_TYPES.has(a.type as AccountType));
  const liabilities = accounts.filter(a => LIABILITY_ACCOUNT_TYPES.has(a.type as AccountType));

  return (
    <FinModalShell title="Net Worth" onClose={onClose} className="md:max-w-[420px]">
      <div className="mb-5 text-[28px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">
        {fmt(netWorth, currency)}
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-[var(--fin-subtle)]">
        Total assets minus total liabilities across all non-archived accounts.
      </p>

      {assets.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fin-subtle)]">Assets</div>
          <div className="overflow-hidden rounded-[10px] border border-[var(--fin-border)]">
            {assets.map((acc, i) => (
              <div key={acc.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--fin-text)]">{acc.name}</div>
                    <div className="text-[10px] text-[var(--fin-subtle)]">
                      {ACCOUNT_TYPE_NAMES[acc.type as AccountType]}
                    </div>
                  </div>
                  <AmountText value={acc.balance} currency={currency} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {liabilities.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fin-subtle)]">
            Liabilities
          </div>
          <div className="overflow-hidden rounded-[10px] border border-[var(--fin-border)]">
            {liabilities.map((acc, i) => (
              <div key={acc.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--fin-text)]">{acc.name}</div>
                    <div className="text-[10px] text-[var(--fin-subtle)]">
                      {ACCOUNT_TYPE_NAMES[acc.type as AccountType]}
                    </div>
                  </div>
                  <AmountText value={-acc.balance} currency={currency} size="sm" sign />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </FinModalShell>
  );
}
