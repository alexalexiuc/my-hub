'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components';
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
    [allLabels, value],
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
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(label => (
            <Pill
              key={label}
              label={label}
              color="var(--accent)"
              onRemove={() => onChange(value.filter(l => l !== label))}
            />
          ))}
        </div>
      )}
      <FinancialDropdown
        options={availableOptions}
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
        closeOnChange
        inputClassName={cn(
          'border-b-0 py-0 text-[13px] font-medium text-[var(--text)] placeholder:text-[var(--subtle)]',
          inputClassName,
        )}
      />
    </div>
  );
}
