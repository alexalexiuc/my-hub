import { cn } from '@/lib/utils';
import type { SortKey } from './types';
import { SectionLabel } from '@/components';

type PayeesTableHeaderProps = {
  sortBy: SortKey;
  onSort: (key: SortKey) => void;
};

const headers = [
  ['name', 'Payee'],
  ['txCount', 'Txns'],
  ['totalSpent', 'Total'],
] as [SortKey, string][];

export function PayeesTableHeader({ sortBy, onSort }: PayeesTableHeaderProps) {
  return (
    <div
      data-layout="desktop"
      className="hidden grid-cols-[1fr_80px_90px] border-b border-[var(--border)] px-[14px] py-[10px] md:grid"
    >
      {headers.map(([key, label]) => (
        <div
          key={key}
          onClick={() => onSort(key)}
          className={cn('cursor-pointer', key === 'name' ? 'text-left' : 'text-right')}
        >
          <SectionLabel className={cn(sortBy === key ? '!text-[var(--accent)]' : '')}>
            {label} {sortBy === key && '↓'}
          </SectionLabel>
        </div>
      ))}
    </div>
  );
}
