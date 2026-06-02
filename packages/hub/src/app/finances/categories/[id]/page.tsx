'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import type { CategoriesResponse, CategoryRow } from '@/app/api/finances/categories/route';
import { CategoryIcon, fmt } from '../../ui';
import { TransactionList } from '../../transactions/TransactionList';
import { transactionEvents } from '../../transactions/transactionEvents';
import { Button, Card, SectionLabel, SubText } from '@/components';
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

  const load = useCallback(() => {
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

  useEffect(() => {
    if (Number.isNaN(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
      router.replace('/finances/categories');
      return;
    }
    load();
  }, [load, categoryId, router]);

  useEffect(() => {
    transactionEvents.on('changed', load);
    return () => transactionEvents.off('changed', load);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[40, 140, 280].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--card)]"
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
        <SubText>{month}</SubText>
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
            <div className="text-[17px] font-bold text-[var(--text)]">{category.name}</div>
            {groupName && <SubText className="block">{groupName}</SubText>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card2)] p-2.5">
            <SubText className="block uppercase tracking-[0.08em]">Spent</SubText>
            <div className="text-[16px] font-semibold text-[var(--text)]">{fmt(category.spent, currency)}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card2)] p-2.5">
            <SubText className="block uppercase tracking-[0.08em]">Target</SubText>
            <div className="text-[16px] font-semibold text-[var(--text)]">
              {target > 0 ? fmt(target, currency) : '—'}
            </div>
          </div>
        </div>
        {progress !== null && (
          <SubText className="block mt-2">
            Progress: <span className="font-semibold text-[var(--text)]">{progress}%</span>
          </SubText>
        )}
        {category.notes && <div className="mt-2 text-[12px] text-[var(--muted)]">{category.notes}</div>}
      </Card>

      <Card className="p-0 md:p-[14px]">
        <SectionLabel className="mb-2.5 mt-[14px] px-[14px] md:mt-0 md:px-0">Transactions</SectionLabel>
        <TransactionList categoryId={categoryId} month={month} />
      </Card>
    </div>
  );
}
