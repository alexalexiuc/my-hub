'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FinancialDropdown } from '../FinancialDropdown';

type LabelMultiSelectProps = {
  allLabels: string[];
  value: string[];
  onChange: (labels: string[]) => void;
  inputClassName?: string;
};

export function LabelMultiSelect({ allLabels, value, onChange, inputClassName }: LabelMultiSelectProps) {
  const selectedSet = new Set(value);

  const availableOptions = useMemo(
    () => allLabels.filter(l => !selectedSet.has(l)).map((l, i) => ({ id: i, value: l })),
    [allLabels, value], // selectedSet is derived from value
  );

  const createOption = useMemo(
    () => ({
      onCreate: (name: string) => {
        const trimmed = name.trim();
        if (trimmed && !selectedSet.has(trimmed)) {
          onChange([...value, trimmed]);
        }
      },
    }),
    [value, onChange], // selectedSet is derived from value
  );

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(label => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--fin-border)] bg-[var(--fin-card2)] px-2 py-0.5 text-[11px] text-[var(--fin-text)]"
            >
              {label}
              <button
                type="button"
                onClick={() => onChange(value.filter(l => l !== label))}
                className="ml-0.5 text-[var(--fin-muted)] hover:text-[var(--fin-text)]"
                aria-label={`Remove label ${label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <FinancialDropdown
        options={availableOptions}
        value={undefined}
        onChange={item => {
          if (item) {
            const label = String(item.value);
            if (!selectedSet.has(label)) {
              onChange([...value, label]);
            }
          }
        }}
        fuse
        placeholder={value.length === 0 ? 'Add labels...' : 'Add another label...'}
        createOption={createOption}
        closeOnChange={true}
        inputClassName={cn(
          'border-b-0 py-0 text-[13px] font-medium text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]',
          inputClassName,
        )}
      />
    </div>
  );
}
