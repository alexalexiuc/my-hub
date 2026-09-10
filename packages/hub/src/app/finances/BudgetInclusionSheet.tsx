'use client';

import { cn } from '@/lib/utils';
import { Divider, IncludeExcludeChip, Modal, SubText } from '@/components';
import { fmt, CategoryIcon } from './ui';
import type { CategoryRow } from '@/app/api/finances/categories/route';

type BudgetInclusionSheetProps = {
  categories: CategoryRow[];
  totalBudgeted: number;
  totalSpent: number;
  currency: string;
  onToggle: (cat: CategoryRow) => void;
  onClose: () => void;
};

type CategoryListSectionProps = {
  categories: CategoryRow[];
  currency: string;
  included: boolean;
  onToggle: (cat: CategoryRow) => void;
};

function CategoryListSection({ categories, currency, included, onToggle }: CategoryListSectionProps) {
  if (!categories.length) return null;
  return (
    <div className={included ? 'mb-4' : undefined}>
      <SubText className="block mb-2 font-semibold uppercase tracking-wider">
        {included ? 'Included' : 'Excluded'}
      </SubText>
      <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
        {categories.map((cat, i) => {
          const over = included && cat.monthlyTarget != null && cat.spent > cat.monthlyTarget;
          return (
            <div key={cat.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <CategoryIcon
                  color={cat.color}
                  icon={cat.icon}
                  size="sm"
                  fallback={cat.name[0]?.toUpperCase() ?? '?'}
                />
                <div
                  className={cn(
                    'min-w-0 flex-1 truncate text-[13px] font-medium',
                    included ? 'text-[var(--text)]' : 'text-[var(--muted)]',
                  )}
                >
                  {cat.name}
                </div>
                <span
                  className={cn(
                    'shrink-0 text-[13px] tabular-nums',
                    over ? 'text-[var(--red)]' : included ? 'text-[var(--text)]' : 'text-[var(--subtle)]',
                  )}
                >
                  {fmt(cat.spent, currency)}
                  {cat.monthlyTarget != null && (
                    <span className="text-[var(--subtle)]"> / {fmt(cat.monthlyTarget, currency)}</span>
                  )}
                </span>
                <IncludeExcludeChip included={included} onToggle={() => onToggle(cat)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Explainer sheet for the aggregate "planned expenses" total (spent vs monthly target across
 * categories with `includeInSpendingBudget`). Mirrors accounts/AvailableBalanceSheet: a big
 * total, a short blurb, and Included/Excluded category lists with toggle chips — the only place
 * inclusion is toggled from (categories don't carry an inline chip on their own row).
 */
export function BudgetInclusionSheet({
  categories,
  totalBudgeted,
  totalSpent,
  currency,
  onToggle,
  onClose,
}: BudgetInclusionSheetProps) {
  const included = categories.filter(c => c.includeInSpendingBudget);
  const excluded = categories.filter(c => !c.includeInSpendingBudget);

  return (
    <Modal title="Planned Expenses" onClose={onClose} className="md:max-w-[420px]">
      <div className="mb-5 text-[28px] font-bold tracking-[-0.02em] text-[var(--text)]">
        {fmt(totalSpent, currency)}
        <span className="ml-1 text-[16px] font-normal text-[var(--subtle)]">/ {fmt(totalBudgeted, currency)}</span>
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-[var(--subtle)]">
        Included categories count toward what you still need to spend this month. Exclude ones you might skip some
        months — savings, portfolio contributions — so they don&apos;t inflate the total.
      </p>

      <CategoryListSection categories={included} currency={currency} included onToggle={onToggle} />
      <CategoryListSection categories={excluded} currency={currency} included={false} onToggle={onToggle} />

      {!included.length && !excluded.length && (
        <div className="py-6 text-center text-[13px] text-[var(--subtle)]">No categories yet.</div>
      )}
    </Modal>
  );
}
