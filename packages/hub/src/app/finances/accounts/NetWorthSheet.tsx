'use client';

import { fmt, Divider, AmountText, SubText } from '../ui';
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
      <div className="mb-5 text-[28px] font-bold tracking-[-0.02em] text-[var(--text)]">{fmt(netWorth, currency)}</div>

      <p className="mb-4 text-[12px] leading-relaxed text-[var(--subtle)]">
        Total assets minus total liabilities across all non-archived accounts.
      </p>

      {assets.length > 0 && (
        <div className="mb-4">
          <SubText className="block mb-2 font-semibold uppercase tracking-wider">Assets</SubText>
          <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
            {assets.map((acc, i) => (
              <div key={acc.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--text)]">{acc.name}</div>
                    <SubText className="block">{ACCOUNT_TYPE_NAMES[acc.type as AccountType]}</SubText>
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
          <SubText className="block mb-2 font-semibold uppercase tracking-wider">Liabilities</SubText>
          <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
            {liabilities.map((acc, i) => (
              <div key={acc.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--text)]">{acc.name}</div>
                    <SubText className="block">{ACCOUNT_TYPE_NAMES[acc.type as AccountType]}</SubText>
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
