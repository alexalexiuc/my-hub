import { cn } from '@/lib/utils';
import type { AccountItem } from '@/app/api/finances/accounts/route';

export function BorrowedLentDetails({ acc, onSettle }: { acc: AccountItem; onSettle: (id: number) => void }) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <div className="flex gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--subtle)]">Direction</div>
          <div
            className={cn(
              'text-xs font-semibold',
              acc.direction === 'gave' ? 'text-[var(--green)]' : 'text-[var(--amber)]',
            )}
          >
            {acc.direction === 'gave' ? 'Lent' : 'Borrowed'}
          </div>
        </div>
        {acc.counterpartyName && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--subtle)]">With</div>
            <div className="text-xs text-[var(--muted)]">{acc.counterpartyName}</div>
          </div>
        )}
        {acc.dueDate && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.06em] text-[var(--subtle)]">Due</div>
            <div className="text-xs text-[var(--amber)]">{acc.dueDate}</div>
          </div>
        )}
        {acc.settled && <div className="self-center text-[11px] text-[var(--green)]">✓ Settled</div>}
      </div>
      {!acc.settled && (
        <button
          onClick={e => {
            e.stopPropagation();
            onSettle(acc.id);
          }}
          className="cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-semibold bg-[var(--teal-d)] text-[var(--teal)]"
          style={{ border: `1px solid var(--teal)44` }}
        >
          Settle
        </button>
      )}
    </div>
  );
}
