'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components';
import { fmt, Divider, AmountText, SubText } from '../ui';
import { FinModalShell } from '../FinModalShell';
import { ACCOUNT_TYPE_NAMES, LIABILITY_ACCOUNT_TYPES } from '@my-hub/shared/constants';
import type { AccountType } from '@my-hub/shared/constants';
import type { AccountItem } from '@/app/api/finances/accounts/route';

type AvailableBalanceSheetProps = {
  accounts: AccountItem[];
  availableBalance: number;
  currency: string;
  onToggle: (id: number, currentlyIncluded: boolean) => void;
  onClose: () => void;
};

type AccountListSectionProps = {
  accounts: AccountItem[];
  currency: string;
  included: boolean;
  onToggle: (id: number, currentlyIncluded: boolean) => void;
};

function AccountListSection({ accounts, currency, included, onToggle }: AccountListSectionProps) {
  if (!accounts.length) return null;
  return (
    <div className={included ? 'mb-4' : undefined}>
      <SubText className="block mb-2 font-semibold uppercase tracking-wider">
        {included ? 'Included' : 'Excluded'}
      </SubText>
      <div className="overflow-hidden rounded-[10px] border border-[var(--fin-border)]">
        {accounts.map((acc, i) => {
          const isLiability = LIABILITY_ACCOUNT_TYPES.has(acc.type as AccountType);
          return (
            <div key={acc.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span className={included ? 'text-[var(--fin-green)]' : 'text-[var(--fin-muted)]'}>
                  {included ? '●' : '○'}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-[13px] font-medium',
                      included ? 'text-[var(--fin-text)]' : 'text-[var(--fin-muted)]',
                    )}
                  >
                    {acc.name}
                  </div>
                  <SubText className="block">{ACCOUNT_TYPE_NAMES[acc.type as AccountType]}</SubText>
                </div>
                {included ? (
                  <AmountText value={isLiability ? -acc.balance : acc.balance} currency={currency} size="sm" sign />
                ) : (
                  <span className="shrink-0 text-[13px] tabular-nums text-[var(--fin-subtle)]">
                    {fmt(acc.balance, currency)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onToggle(acc.id, included)}
                  className={cn(
                    'shrink-0 rounded-md border border-[var(--fin-border)] text-[10px]',
                    included
                      ? 'hover:border-[var(--fin-red)] hover:text-[var(--fin-red)]'
                      : 'hover:border-[var(--fin-green)] hover:text-[var(--fin-green)]',
                  )}
                >
                  {included ? 'Exclude' : 'Include'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AvailableBalanceSheet({
  accounts,
  availableBalance,
  currency,
  onToggle,
  onClose,
}: AvailableBalanceSheetProps) {
  const included = accounts.filter(a => a.includedInAvailable);
  const excluded = accounts.filter(a => !a.includedInAvailable);

  return (
    <FinModalShell title="Available Balance" onClose={onClose} className="md:max-w-[420px]">
      <div className="mb-5 text-[28px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">
        {fmt(availableBalance, currency)}
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-[var(--fin-subtle)]">
        Bank and Cash accounts are included by default. Toggle any account below to customise what counts toward your
        available balance.
      </p>

      <AccountListSection accounts={included} currency={currency} included onToggle={onToggle} />
      <AccountListSection accounts={excluded} currency={currency} included={false} onToggle={onToggle} />

      {!included.length && !excluded.length && (
        <div className="py-6 text-center text-[13px] text-[var(--fin-subtle)]">No active accounts yet.</div>
      )}
    </FinModalShell>
  );
}
