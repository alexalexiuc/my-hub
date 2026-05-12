'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import { PlusOutlineIcon } from '@/components/icons';
import { TransactionModal } from './transactions/TransactionModal';
import type { BudgetDetailResponse } from '@/app/api/finances/budget/route';

const LEFT_ITEMS = [
  { id: 'dashboard', icon: '◈', label: 'Home', path: '/finances' },
  { id: 'accounts', icon: '⊞', label: 'Accounts', path: '/finances/accounts' },
];

const RIGHT_ITEMS = [{ id: 'categories', icon: '⬡', label: 'Categories', path: '/finances/categories' }];

const MORE_ITEMS = [
  { id: 'transactions', icon: '↕', label: 'Transactions', path: '/finances/transactions' },
  { id: 'goals', icon: '◎', label: 'Goals', path: '/finances/goals' },
  { id: 'monthly-plan', icon: '⊟', label: 'Monthly Plan', path: '/finances/monthly-plan' },
  { id: 'budget', icon: '▦', label: 'Budget', path: '/finances/budget' },
  { id: 'cashflow', icon: '⟳', label: 'Cashflow', path: '/finances/cashflow' },
  { id: 'payees', icon: '◉', label: 'Payees', path: '/finances/payees' },
  { id: 'networth', icon: '▲', label: 'Net Worth', path: '/finances/networth' },
  { id: 'settings', icon: '⚙', label: 'Settings', path: '/finances/settings' },
];

type FinancesBottomNavProps = {
  className?: string;
};

function MoreSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);

  // Trigger enter transition after first paint
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      onClick={onClose}
      className={cn(
        'fixed inset-0 z-[1000] flex items-end transition-[background-color] duration-300',
        open ? 'bg-[var(--fin-overlay)]' : 'bg-transparent',
      )}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={cn(
          'w-full rounded-t-[18px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-4 pb-8 transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--fin-border)]" />
        <div className="mb-3 px-1 text-[11px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">More</div>
        <div className="grid grid-cols-2 gap-2">
          {MORE_ITEMS.map(({ id, icon, label, path }) => {
            const active = isActive(path);
            return (
              <button
                key={id}
                onClick={() => {
                  router.push(path);
                  onClose();
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] font-medium',
                  active
                    ? 'border-[var(--fin-accent)44] bg-[var(--fin-accent-d)] text-[var(--fin-accent)]'
                    : 'border-[var(--fin-border)] bg-[var(--fin-card2)] text-[var(--fin-text)]',
                )}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function FinancesBottomNav({ className }: FinancesBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddTx, setShowAddTx] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [hasBudget, setHasBudget] = useState<boolean | null>(null);

  const fetchBudget = useCallback(() => {
    apiFetch<BudgetDetailResponse>('/api/finances/budget', { silentToast: true })
      .then(() => setHasBudget(true))
      .catch(() => setHasBudget(false));
  }, []);

  useEffect(() => {
    fetchBudget();
    window.addEventListener('finances:budget-changed', fetchBudget);
    return () => window.removeEventListener('finances:budget-changed', fetchBudget);
  }, [fetchBudget]);

  if (hasBudget === false) return null;

  const isActive = (path: string) => (path === '/finances' ? pathname === '/finances' : pathname.startsWith(path));
  const moreIsActive = MORE_ITEMS.some(item => pathname.startsWith(item.path));

  return (
    <>
      {showAddTx && (
        <TransactionModal onCloseAction={() => setShowAddTx(false)} onSavedAction={() => setShowAddTx(false)} />
      )}
      {showMore && <MoreSheet onClose={() => setShowMore(false)} />}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[900] flex border-t border-[var(--fin-border)] bg-[var(--fin-card)]',
          className,
        )}
      >
        {LEFT_ITEMS.map(({ id, icon, label, path }) => {
          const active = isActive(path);
          return (
            <button
              key={id}
              onClick={() => router.push(path)}
              className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2"
            >
              <span
                className={cn('text-lg leading-none', active ? 'text-[var(--fin-accent)]' : 'text-[var(--fin-subtle)]')}
              >
                {icon}
              </span>
              <span
                className={cn(
                  'text-[9px]',
                  active ? 'font-semibold text-[var(--fin-accent)]' : 'text-[var(--fin-subtle)]',
                )}
              >
                {label}
              </span>
            </button>
          );
        })}

        {/* FAB */}
        <button
          onClick={() => setShowAddTx(true)}
          className="flex flex-1 cursor-pointer flex-col items-center border-none bg-transparent pt-1"
        >
          <div className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fin-accent)] text-[var(--fin-on-solid)] shadow-[0_4px_12px_rgba(167,139,250,0.4)]">
            <PlusOutlineIcon className="size-5" />
          </div>
          <span className="mt-1 text-[9px] text-[var(--fin-subtle)]">Add</span>
        </button>

        {RIGHT_ITEMS.map(({ id, icon, label, path }) => {
          const active = isActive(path);
          return (
            <button
              key={id}
              onClick={() => router.push(path)}
              className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2"
            >
              <span
                className={cn('text-lg leading-none', active ? 'text-[var(--fin-accent)]' : 'text-[var(--fin-subtle)]')}
              >
                {icon}
              </span>
              <span
                className={cn(
                  'text-[9px]',
                  active ? 'font-semibold text-[var(--fin-accent)]' : 'text-[var(--fin-subtle)]',
                )}
              >
                {label}
              </span>
            </button>
          );
        })}

        {/* More */}
        <button
          onClick={() => setShowMore(true)}
          className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2"
        >
          <span
            className={cn(
              'text-lg leading-none',
              moreIsActive ? 'text-[var(--fin-accent)]' : 'text-[var(--fin-subtle)]',
            )}
          >
            ···
          </span>
          <span
            className={cn(
              'text-[9px]',
              moreIsActive ? 'font-semibold text-[var(--fin-accent)]' : 'text-[var(--fin-subtle)]',
            )}
          >
            More
          </span>
        </button>
      </div>
    </>
  );
}
