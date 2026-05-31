import { cn } from '@/lib/utils';
import { Button } from '@/components';
import type { Range } from './types';

type PayeesRangeFilterProps = {
  range: Range;
  onChange: (range: Range) => void;
  ranges: { key: Range; label: string }[];
};

export function PayeesRangeFilter({ range, onChange, ranges }: PayeesRangeFilterProps) {
  return (
    <div className="flex gap-1.5">
      {ranges.map(({ key, label }) => {
        const active = range === key;
        return (
          <Button
            key={key}
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onChange(key)}
            className={cn(
              'rounded-[20px] px-3 py-[5px] text-[11px] transition-colors',
              active
                ? 'bg-[var(--accent-d)] font-semibold text-[var(--accent)] border border-[var(--accent)]'
                : 'bg-[var(--card2)] text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--accent-d)] hover:text-[var(--accent)] hover:border-[var(--accent)]',
            )}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
