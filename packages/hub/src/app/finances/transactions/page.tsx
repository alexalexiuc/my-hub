'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import { AddButton, Card } from '../ui';
import { Button } from '@/components';
import { TransactionModal } from './TransactionModal';
import { TransactionList } from './TransactionList';
import { transactionEvents } from './transactionEvents';
import { TransactionType, TransactionTypes } from '@my-hub/shared/constants';
import { MonthCarousel } from '../ui';
import { dateToString } from '@my-hub/shared/utils';

type Filter = 'all' | TransactionType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: TransactionTypes.Expense, label: 'Expenses' },
  { key: TransactionTypes.Income, label: 'Income' },
  { key: TransactionTypes.Transfer, label: 'Transfers' },
];

function currentMonthStr(): string {
  return dateToString().slice(0, 7);
}

export default function TransactionsPage() {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastImport, setLastImport] = useState<{ batchId: string; count: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [month, setMonth] = useState(currentMonthStr);

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

  function handleCreated() {
    setShowAddModal(false);
    transactionEvents.emit('changed');
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Transactions</div>

      {/* Desktop header */}
      <div className="hidden items-center justify-between md:flex">
        <MonthCarousel month={month} onNavigate={setMonth} currentMonth={currentMonthStr()} />
        <div className="flex items-center gap-2">
          <Link href="/finances/transactions/import">
            <Button variant="ghost">Import CSV</Button>
          </Link>
          <AddButton onClick={() => setShowAddModal(true)} title="Add transaction" />
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <div className="mb-2 flex items-center justify-between rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2.5">
          <MonthCarousel
            month={month}
            onNavigate={setMonth}
            currentMonth={currentMonthStr()}
            className="flex-1 justify-between"
            labelClassName="text-[32px] font-bold leading-none tracking-tight"
          />
        </div>
      </div>

      {/* Undo import banner */}
      {lastImport && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2 text-xs text-[var(--fin-text)]">
          <span>
            Imported {lastImport.count} transaction{lastImport.count !== 1 ? 's' : ''}
          </span>
          <Button variant="transparent" onClick={handleUndo} className="text-[var(--fin-red)] font-medium">
            Undo import
          </Button>
        </div>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => (
          <Button key={key} active={filter === key} variant="fin-pill" size="xs" onClick={() => setFilter(key)}>
            {label}
          </Button>
        ))}
      </div>

      <Card className="p-0 md:p-[14px]">
        <TransactionList month={month} type={filter === 'all' ? undefined : filter} />
      </Card>

      {showAddModal && <TransactionModal onCloseAction={() => setShowAddModal(false)} onSavedAction={handleCreated} />}
    </div>
  );
}
