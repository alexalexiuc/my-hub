import { cn } from '@/lib/utils';
import { Button } from './Button';

type IncludeExcludeChipProps = {
  included: boolean;
  onToggle: () => void;
  className?: string;
};

export function IncludeExcludeChip({ included, onToggle, className }: IncludeExcludeChipProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onToggle}
      className={cn(
        'shrink-0 rounded-md border border-[var(--border)] text-[10px]',
        included
          ? 'hover:border-[var(--red)] hover:text-[var(--red)]'
          : 'hover:border-[var(--green)] hover:text-[var(--green)]',
        className,
      )}
    >
      {included ? 'Exclude' : 'Include'}
    </Button>
  );
}
