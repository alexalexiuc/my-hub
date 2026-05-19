'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import type { CategoriesResponse, CategoryRow } from '@/app/api/finances/categories/route';
import { Card, CategoryIcon, SectionLabel, fmt } from '../../ui';
import { TransactionList } from '../../transactions/TransactionList';
import { Button } from '@/components';
import { getCategoryFallbackLetter, normalizeYearMonth } from '../../finances.utils';

type CategorySummary = {
  category: CategoryRow;
  currency: string;
  groupName: string | null;
};

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = normalizeYearMonth(searchParams.get('month'));
  const categoryId = Number(params.id);

  const [data, setData] = useState<CategorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const backPath = useMemo(() => `/finances/categories?month=${month}`, [month]);

  useEffect(() => {
    if (Number.isNaN(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
      router.replace('/finances/categories');
      return;
    }

    setLoading(true);
    apiFetch<CategoriesResponse>(`/api/finances/categories?month=${month}`, { silentToast: true })
      .then(categories => {
        const category = categories.allCategories.find(item => item.id === categoryId);
        if (!category) {
          router.replace('/finances/categories');
          return;
        }
        setData({
          category,
          currency: categories.currency,
          groupName: categories.groups.find(group => group.id === category.groupId)?.name ?? null,
        });
      })
      .finally(() => setLoading(false));
  }, [categoryId, month, router]);

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

  const { category, currency, groupName } = data;
  const target = category.monthlyTarget ?? 0;
  const progress = target > 0 ? Math.round((category.spent / target) * 100) : null;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-2.5">
        <Button variant="ghost" size="sm" onClick={() => router.push(backPath)}>
          ← Back
        </Button>
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
        {category.transferAmount > 0 && (
          <div className="mt-2 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] p-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">Loan repayments</div>
            <div className="text-[16px] font-semibold text-[var(--fin-text)]">
              {fmt(category.transferAmount, currency)}
            </div>
          </div>
        )}
        {progress !== null && (
          <div className="mt-2 text-[11px] text-[var(--fin-subtle)]">
            Progress: <span className="font-semibold text-[var(--fin-text)]">{progress}%</span>
          </div>
        )}
        {category.notes && <div className="mt-2 text-[12px] text-[var(--fin-muted)]">{category.notes}</div>}
      </Card>

      <Card className="p-0 md:p-[14px]">
        <SectionLabel className="mb-2.5 mt-[14px] px-[14px] md:mt-0 md:px-0">Transactions</SectionLabel>
        <TransactionList categoryId={categoryId} month={month} />
      </Card>
    </div>
  );
}
