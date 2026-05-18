'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { Card, SectionLabel } from '../ui';
import type { MonthlyPlanResponse, MonthlyPlanItem } from '@/app/api/finances/monthly-plans/[month]/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import { SummaryBar } from './SummaryBar';
import { MonthHeader } from './MonthHeader';
import { PlanItemRow } from './PlanItemRow';
import { PlanItemModal } from './PlanItemModal';
import { fmtNum } from './monthly-plan.utils';
import { dateToString } from '@my-hub/shared/utils';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import type { SupportedCurrency } from '@my-hub/shared/constants';

const DESKTOP_HEADERS = [
  { label: 'Item', align: '' },
  { label: 'Planned', align: 'text-right' },
  { label: 'Assigned', align: 'text-right' },
  { label: 'Linked to', align: '' },
  { label: 'Done', align: 'text-right' },
] as const;

export function MonthlyPlanScreen() {
  const [month, setMonth] = useState(dateToString(new Date(), 'YYYY-MM'));
  const [data, setData] = useState<MonthlyPlanResponse | null>(null);
  const [formData, setFormData] = useState<TransactionFormDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MonthlyPlanItem | null>(null);
  const [openRowId, setOpenRowId] = useState<number | null>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<MonthlyPlanResponse>(`/api/finances/monthly-plans/${m}`, { silentToast: true });
      setData(res);
    } catch {
      setError('Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  useEffect(() => {
    apiFetch<TransactionFormDataResponse>('/api/finances/transactions/form-data', { silentToast: true })
      .then(setFormData)
      .catch(() => null);
  }, []);

  const withRefresh = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn();
      await load(month);
    },
    [load, month],
  );

  const navigate = (m: string) => {
    setShowAddItem(false);
    setMonth(m);
  };

  const allDone = data != null && data.summary.totalCount > 0 && data.summary.assignedCount === data.summary.totalCount;
  const itemUrl = (id: number) => `/api/finances/monthly-plans/${month}/items/${id}`;
  const addItemDefaultCurrency: SupportedCurrency =
    data != null && SupportedCurrencies.includes(data.currency as SupportedCurrency)
      ? (data.currency as SupportedCurrency)
      : SupportedCurrencies[0];

  return (
    <>
      <div>
        <MonthHeader
          month={month}
          nextMonthExists={data?.nextMonthExists}
          allDone={allDone}
          itemCount={data?.items.length ?? 0}
          onNavigate={navigate}
          onRefresh={() => load(month)}
        />

        {data && (
          <SummaryBar
            availableAmount={data.availableAmount}
            incomeAccountId={data.incomeAccountId}
            summary={data.summary}
            accounts={formData?.accounts ?? []}
            onPlanMetaChange={patch =>
              withRefresh(() => apiFetch(`/api/finances/monthly-plans/${month}`, { method: 'PATCH', body: patch }))
            }
          />
        )}

        <Card className="overflow-hidden p-0">
          <div
            data-layout="desktop"
            className="hidden grid-cols-[1fr_8rem_8rem_15rem_3rem] gap-3 border-b border-[var(--fin-border)] px-4 py-2.5 md:grid"
          >
            {DESKTOP_HEADERS.map(({ label, align }) => (
              <SectionLabel key={label} className={align}>
                {label}
              </SectionLabel>
            ))}
          </div>
          <div
            data-layout="mobile"
            className="flex items-center border-b border-[var(--fin-border)] px-4 py-2 md:hidden"
          >
            <SectionLabel className="flex-1">Item</SectionLabel>
            <div className="flex shrink-0 gap-3">
              <SectionLabel className="text-right">Planned</SectionLabel>
              <SectionLabel className="text-right">Assigned</SectionLabel>
            </div>
          </div>

          {loading && <div className="py-12 text-center text-[13px] text-[var(--fin-muted)]">Loading…</div>}
          {!loading && error && <div className="py-12 text-center text-[13px] text-[var(--fin-red)]">{error}</div>}

          {!loading && !error && data && (
            <>
              {data.items.length === 0 && !showAddItem && (
                <div className="py-10 text-center text-[13px] text-[var(--fin-muted)]">
                  No items yet — add your first planned expense below.
                </div>
              )}
              <div className="md:p-0">
                {data.items.map(item => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    currency={data.currency}
                    onToggle={(v: boolean) =>
                      withRefresh(() =>
                        apiFetch(itemUrl(item.id), { method: 'PATCH', body: { isAssigned: v }, silentToast: true }),
                      )
                    }
                    onDelete={() =>
                      withRefresh(() => apiFetch(itemUrl(item.id), { method: 'DELETE', silentToast: true }))
                    }
                    onEdit={() => setEditingItem(item)}
                    isOpen={openRowId === item.id}
                    onOpen={() => setOpenRowId(item.id)}
                    onClose={() => setOpenRowId(null)}
                  />
                ))}
              </div>
            </>
          )}

          {!loading && !error && data && (
            <div className="flex flex-col gap-2 border-t border-[var(--fin-border)] px-3 py-3 md:flex-row md:items-center md:justify-between md:px-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddItem(true)}
                className="border-[var(--fin-border)] text-[var(--fin-muted)] hover:border-[var(--fin-accent)] hover:text-[var(--fin-accent)]"
              >
                + Add item
              </Button>
              <div className="flex items-center gap-4 text-[11px] text-[var(--fin-muted)]">
                <span>
                  Planned: <strong className="text-[var(--fin-text)]">{fmtNum(data.summary.planned)}</strong>
                </span>
                <span>
                  Assigned:{' '}
                  <strong className="text-[var(--fin-text)]">
                    {fmtNum(data.availableAmount - data.summary.remainingReal)}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showAddItem && data && (
        <PlanItemModal
          defaultCurrency={addItemDefaultCurrency}
          formData={formData}
          onSave={async patch => {
            await withRefresh(() =>
              apiFetch(`/api/finances/monthly-plans/${month}/items`, { method: 'POST', body: patch }),
            );
            setShowAddItem(false);
          }}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {editingItem && data && (
        <PlanItemModal
          item={editingItem}
          defaultCurrency={addItemDefaultCurrency}
          formData={formData}
          onClose={() => setEditingItem(null)}
          onSave={async patch => {
            await withRefresh(() =>
              apiFetch(itemUrl(editingItem.id), { method: 'PATCH', body: patch, silentToast: true }),
            );
            setEditingItem(null);
          }}
        />
      )}
    </>
  );
}
