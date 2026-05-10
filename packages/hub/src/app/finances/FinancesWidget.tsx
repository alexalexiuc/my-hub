'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { EyeOffOutlineIcon, EyeOutlineIcon, PlusOutlineIcon } from '@/components/icons';
import { apiFetch } from '@/lib/utils';
import { CategoryIcon, fmt } from './ui';
import { TransactionModal } from './transactions/TransactionModal';
import type { DashboardResponse, FinanceDashboardData } from '@/app/api/finances/contracts';
import Link from 'next/link';

export function FinancesWidget() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [revealed, setRevealed] = useState(false);

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

  return (
    <SectionCard
      title="Finances"
      titleHref="/finances"
      titleHoverClass="hover:text-violet-400"
      className="border-violet-800/50 bg-gradient-to-br from-violet-950/40 to-zinc-900"
      action={
        <div className="flex items-center gap-2">
          {data && (
            <button
              onClick={() => setRevealed(r => !r)}
              className="text-zinc-500 hover:text-zinc-300 transition"
              title={revealed ? 'Hide amounts' : 'Show amounts'}
            >
              {revealed ? <EyeOutlineIcon className="size-3.5" /> : <EyeOffOutlineIcon className="size-3.5" />}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-all"
            title="Add transaction"
          >
            <PlusOutlineIcon className="size-3" />
            Add
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-4 gap-2 mt-2 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
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
        <>
          {/* Category grid */}
          {data.categories.length > 0 && (
            <div className="grid grid-cols-4 gap-1 mt-2">
              {data.categories.slice(0, 8).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setShowAdd(true)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800/60 transition-colors group"
                >
                  <CategoryIcon color={cat.color} icon={cat.icon} size="lg" />
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 truncate w-full text-center transition-colors">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Recent transactions */}
          {data.recentTransactions.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {data.recentTransactions.slice(0, 3).map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon color={tx.categoryColor} icon={tx.categoryIcon} size="sm" />
                    <span className="text-xs text-zinc-300 truncate">
                      {tx.payeeName ?? tx.categoryName ?? 'Transaction'}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums ml-2 shrink-0 text-zinc-200">
                    {revealed ? fmt(tx.amount, data.currency) : '*** **'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <TransactionModal
          onCloseAction={() => setShowAdd(false)}
          onSavedAction={() => {
            setShowAdd(false);
            load(true);
          }}
        />
      )}
    </SectionCard>
  );
}
