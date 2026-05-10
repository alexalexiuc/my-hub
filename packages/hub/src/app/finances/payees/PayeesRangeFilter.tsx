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
                ? 'bg-[var(--fin-accent-d)] font-semibold text-[var(--fin-accent)] border border-[var(--fin-accent)]'
                : 'bg-[var(--fin-card2)] text-[var(--fin-muted)] border border-[var(--fin-border)] hover:bg-[var(--fin-accent-d)] hover:text-[var(--fin-accent)] hover:border-[var(--fin-accent)]',
            )}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
