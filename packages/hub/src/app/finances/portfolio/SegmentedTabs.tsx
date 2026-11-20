import { cn } from '@/lib/utils';

export type SegmentedTabsProps<K extends string> = {
  label: string;
  options: readonly { key: K; label: string; title?: string }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
};

/** Pill-style single-select tab row (range pickers, series switches). */
export function SegmentedTabs<K extends string>({ label, options, value, onChange, className }: SegmentedTabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('mb-3 flex rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-0.5', className)}
    >
      {options.map(({ key, label: text, title }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            title={title}
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex-auto whitespace-nowrap rounded-[8px] px-1 py-1.5 text-[11px] transition-colors sm:text-[12px]',
              active
                ? 'bg-[var(--accent-d)] font-semibold text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]',
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
