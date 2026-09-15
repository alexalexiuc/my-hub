'use client';

import { useEffect, useState } from 'react';
import { Card, Divider, ProgressBar, SectionLabel, SubText } from '@/components';
import { apiFetch } from '@/lib/utils';
import { CategoryIcon, fmt } from '../ui';
import { getCategoryFallbackLetter } from '../finances.utils';
import { categorySpendingResponseSchema } from '@/app/api/finances/reports/category-spending/category-spending.schema';
import type { CategorySpendingData } from '@/app/api/finances/reports/category-spending/category-spending.schema';

type CategoryCashflowSectionProps = {
  year: number;
};

/** A year's expense spending split by category, highest first. Loads its own data. */
export function CategoryCashflowSection({ year }: CategoryCashflowSectionProps) {
  const [data, setData] = useState<CategorySpendingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    apiFetch('/api/finances/reports/category-spending', {
      query: { year },
      responseSchema: categorySpendingResponseSchema,
      silentToast: true,
    })
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load category spending');
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return (
    <Card className="p-4">
      <SectionLabel className="mb-3">By category — {year}</SectionLabel>

      {error ? (
        <div className="py-6 text-center text-[13px] text-[var(--red)]">{error}</div>
      ) : !data ? (
        <div className="h-[120px] rounded-lg bg-[var(--card2)] opacity-50" />
      ) : data.categories.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--subtle)]">No spending in {year}</div>
      ) : (
        data.categories.map((cat, i) => (
          <div key={cat.categoryId ?? 'uncategorised'}>
            {i > 0 && <Divider />}
            <div className="flex items-center gap-2.5 py-2">
              <CategoryIcon
                color={cat.color}
                icon={cat.icon}
                size="md"
                fallback={getCategoryFallbackLetter(cat.name)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-[var(--text)]">{cat.name}</div>
                <ProgressBar
                  value={cat.spent}
                  max={data.categories[0]?.spent ?? cat.spent}
                  color={cat.color ?? 'var(--green)'}
                  height={3}
                  thresholds={false}
                  className="mt-1"
                />
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13px] font-semibold text-[var(--text)]">{fmt(cat.spent, data.currency)}</div>
                <SubText className="block">
                  {data.totalSpent > 0 ? Math.round((cat.spent / data.totalSpent) * 100) : 0}% of total
                </SubText>
              </div>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
