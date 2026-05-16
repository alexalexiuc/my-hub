'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import type { CategoriesResponse, CategoryRow } from '@/app/api/finances/categories/route';
import type { TransactionListItem, TransactionsListResponse } from '@/app/api/finances/transactions/route';
import { Card, CategoryIcon, SectionLabel, fmt } from '../../ui';
import { TransactionList } from '../../transactions/TransactionList';
import { getCategoryFallbackLetter, normalizeYearMonth, sortTransactionsByDateDesc } from '../../finances.utils';

type CategoryDetailState = {
  category: CategoryRow;
  currency: string;
  groupName: string | null;
  transactions: TransactionListItem[];
};

const TRANSACTION_PAGE_LIMIT = 50;

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = normalizeYearMonth(searchParams.get('month'));
  const categoryId = Number(params.id);

  const [data, setData] = useState<CategoryDetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const backPath = useMemo(() => `/finances/categories?month=${month}`, [month]);

  const load = useCallback(
    async ({
      reset,
      offsetValue,
      existingTransactions,
    }: {
      reset: boolean;
      offsetValue: number;
      existingTransactions: TransactionListItem[];
    }) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        if (Number.isNaN(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
          router.replace('/finances/categories');
          return;
        }

        let summary: Omit<CategoryDetailState, 'transactions'> | null = null;

        if (reset) {
          const categories = await apiFetch<CategoriesResponse>(`/api/finances/categories?month=${month}`, {
            silentToast: true,
          });
          const category = categories.allCategories.find(item => item.id === categoryId);
          if (!category) {
            router.replace('/finances/categories');
            return;
          }

          summary = {
            category,
            currency: categories.currency,
            groupName: categories.groups.find(group => group.id === category.groupId)?.name ?? null,
          };
        }

        const transactionsResult = await apiFetch<TransactionsListResponse>(
          `/api/finances/transactions?month=${month}&categoryId=${categoryId}&limit=${TRANSACTION_PAGE_LIMIT}&offset=${offsetValue}`,
          { silentToast: true },
        );
        const pageTransactions = transactionsResult.transactions;
        const mergedTransactions = reset ? pageTransactions : [...existingTransactions, ...pageTransactions];
        const sortedTransactions = sortTransactionsByDateDesc(mergedTransactions);

        setData(prev => {
          const nextSummary =
            summary ?? (prev ? { category: prev.category, currency: prev.currency, groupName: prev.groupName } : null);
          if (!nextSummary) return prev;
          return { ...nextSummary, transactions: sortedTransactions };
        });
        setOffset(offsetValue + pageTransactions.length);
        setHasMore(pageTransactions.length === TRANSACTION_PAGE_LIMIT);
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [categoryId, month, router],
  );

  useEffect(() => {
    setOffset(0);
    setHasMore(false);
    load({ reset: true, offsetValue: 0, existingTransactions: [] });
  }, [load]);

  function loadMore() {
    if (!data) return;
    load({ reset: false, offsetValue: offset, existingTransactions: data.transactions });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[40, 140, 280].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
            style={{ height: h, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { category, currency, transactions, groupName } = data;
  const target = category.monthlyTarget ?? 0;
  const progress = target > 0 ? Math.round((category.spent / target) * 100) : null;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => router.push(backPath)}
          className="cursor-pointer rounded-md border border-[var(--fin-border)] bg-transparent px-2.5 py-[5px] text-xs text-[var(--fin-muted)]"
        >
          ← Back
        </button>
        <span className="text-[11px] text-[var(--fin-subtle)]">{month}</span>
      </div>

      <Card className="p-[14px]">
        <div className="mb-3 flex items-center gap-2.5">
          <CategoryIcon
            color={category.color}
            icon={category.icon}
            size="lg"
            fallback={getCategoryFallbackLetter(category.name)}
          />
          <div>
            <div className="text-[17px] font-bold text-[var(--fin-text)]">{category.name}</div>
            {groupName && <div className="text-[11px] text-[var(--fin-subtle)]">{groupName}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] p-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Spent</div>
            <div className="text-[16px] font-semibold text-[var(--fin-text)]">{fmt(category.spent, currency)}</div>
          </div>
          <div className="rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] p-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Target</div>
            <div className="text-[16px] font-semibold text-[var(--fin-text)]">
              {target > 0 ? fmt(target, currency) : '—'}
            </div>
          </div>
        </div>
        {progress !== null && (
          <div className="mt-2 text-[11px] text-[var(--fin-subtle)]">
            Progress: <span className="font-semibold text-[var(--fin-text)]">{progress}%</span>
          </div>
        )}
        {category.notes && <div className="mt-2 text-[12px] text-[var(--fin-muted)]">{category.notes}</div>}
      </Card>

      <div className="-mx-7 border-y border-[var(--fin-border)] bg-[var(--fin-card)] md:mx-0 md:rounded-[10px] md:border md:p-[14px]">
        <SectionLabel className="mb-2.5 mt-[14px] px-[14px] md:mt-0 md:px-0">Transactions</SectionLabel>
        <TransactionList transactions={transactions} currency={currency} showAccount />
        {hasMore && (
          <div className="px-[14px] pb-[14px] md:px-0 md:pb-0">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2.5 w-full cursor-pointer rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] p-2 text-xs text-[var(--fin-muted)] disabled:cursor-default disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
