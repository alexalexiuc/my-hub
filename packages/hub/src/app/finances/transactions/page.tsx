'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AddButton } from '../ui';
import { Button, Card, DateMode, IconButton } from '@/components';
import { FunnelIcon } from '@/components/icons';
import { TransactionModal } from './TransactionModal';
import { TransactionList } from './TransactionList';
import { transactionEvents } from './transactionEvents';
import { TransactionFilters } from './TransactionFilters';
import type { ExtraFilterValues } from './TransactionFilters';
import type { TransactionType } from '@my-hub/shared/constants';
import { dateToString } from '@my-hub/shared/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { SmartDatePicker } from '../SmartDatePicker';

type Filter = 'all' | TransactionType;

function currentMonthStr(): string {
  return dateToString().slice(0, 7);
}

const EMPTY_EXTRA: ExtraFilterValues = {
  addedByUserId: '',
  accountId: '',
  categoryId: '',
  label: '',
  amountGte: '',
  amountLte: '',
  search: '',
};

export default function TransactionsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastImport, setLastImport] = useState<{ batchId: string; count: number } | null>(null);

  const [dateMode, setDateMode] = useState<DateMode>('month');
  const [month, setMonth] = useState(currentMonthStr);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Filter>('all');
  const [extra, setExtra] = useState<ExtraFilterValues>(EMPTY_EXTRA);

  const debouncedSearch = useDebounce(extra.search, 400);
  const debouncedAmountGte = useDebounce(extra.amountGte, 400);
  const debouncedAmountLte = useDebounce(extra.amountLte, 400);

  const activeFilterCount = [
    typeFilter !== 'all',
    dateMode !== 'month',
    !!extra.addedByUserId,
    !!extra.accountId,
    !!extra.categoryId,
    !!extra.label,
    !!extra.amountGte,
    !!extra.amountLte,
    !!extra.search,
  ].filter(Boolean).length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get('imported');
    const count = params.get('count');
    if (batchId && count) {
      setLastImport({ batchId, count: parseInt(count, 10) });
      router.replace('/finances/transactions', { scroll: false });
    }
  }, []);

  async function handleUndo() {
    if (!lastImport) return;
    await apiFetch(`/api/finances/transactions/import/${lastImport.batchId}`, { method: 'DELETE' });
    setLastImport(null);
    transactionEvents.emit('changed');
  }

  function handleDateChange(patch: { dateMode?: DateMode; month?: string; fromDate?: string; toDate?: string }) {
    if (patch.dateMode !== undefined) setDateMode(patch.dateMode);
    if (patch.month !== undefined) setMonth(patch.month);
    if (patch.dateMode === 'all') {
      setFromDate('');
      setToDate('');
    } else {
      if (patch.fromDate !== undefined) setFromDate(patch.fromDate);
      if (patch.toDate !== undefined) setToDate(patch.toDate);
    }
  }

  const funnelButton = (
    <IconButton
      label="Toggle filters"
      variant="ghost"
      icon={
        <>
          <FunnelIcon className="size-3.5" />
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </>
      }
      onClick={() => setFiltersOpen(o => !o)}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
        filtersOpen || activeFilterCount > 0
          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--text)]',
      )}
    />
  );

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">Transactions</div>

      {/* Desktop header */}
      <div data-layout="desktop" className="hidden items-center justify-between md:flex">
        <SmartDatePicker
          dateMode={dateMode}
          month={month}
          fromDate={fromDate}
          toDate={toDate}
          currentMonth={currentMonthStr()}
          onChange={handleDateChange}
          extendedFilters
        />
        <div className="flex items-center gap-2">
          {funnelButton}
          <Link href="/finances/transactions/import">
            <Button variant="ghost">Import CSV</Button>
          </Link>
          <AddButton onClick={() => setShowAddModal(true)} title="Add transaction" />
        </div>
      </div>

      {/* Mobile header */}
      <div data-layout="mobile" className="md:hidden">
        <SmartDatePicker
          dateMode={dateMode}
          month={month}
          fromDate={fromDate}
          toDate={toDate}
          currentMonth={currentMonthStr()}
          onChange={handleDateChange}
          trailing={funnelButton}
        />
      </div>

      {/* Undo import banner */}
      {lastImport && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card2)] px-3 py-2 text-xs text-[var(--text)]">
          <span>
            Imported {lastImport.count} transaction{lastImport.count !== 1 ? 's' : ''}
          </span>
          <Button variant="transparent" onClick={handleUndo} className="font-medium text-[var(--red)]">
            Undo import
          </Button>
        </div>
      )}

      {filtersOpen && (
        <TransactionFilters
          typeFilter={typeFilter}
          extraValues={extra}
          onTypeChange={setTypeFilter}
          onExtraChange={patch => setExtra(prev => ({ ...prev, ...patch }))}
        />
      )}

      <Card className="p-0 md:p-[14px]">
        <TransactionList
          month={dateMode === 'month' ? month : undefined}
          fromDate={dateMode === 'range' ? fromDate : undefined}
          toDate={dateMode === 'range' ? toDate : undefined}
          type={typeFilter === 'all' ? undefined : typeFilter}
          addedByUserId={extra.addedByUserId || undefined}
          accountId={extra.accountId ? Number(extra.accountId) : undefined}
          categoryId={extra.categoryId ? Number(extra.categoryId) : undefined}
          label={extra.label || undefined}
          amountGte={debouncedAmountGte ? parseFloat(debouncedAmountGte) : undefined}
          amountLte={debouncedAmountLte ? parseFloat(debouncedAmountLte) : undefined}
          search={debouncedSearch || undefined}
        />
      </Card>

      {showAddModal && (
        <TransactionModal
          onCloseAction={() => setShowAddModal(false)}
          onSavedAction={() => {
            setShowAddModal(false);
            transactionEvents.emit('changed');
          }}
        />
      )}
    </div>
  );
}
