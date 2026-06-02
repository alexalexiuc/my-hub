'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/Pill';
import { SearchableSelect } from './SearchableSelect';
import type { DropdownOption, SelectCreateOption } from './searchableSelect.utils';

type MultiSelectProps = {
  options: DropdownOption[];
  value: Array<string | number>;
  onChange: (value: Array<string | number>) => void;
  createOption?: SelectCreateOption;
  placeholder?: string;
  inputClassName?: string;
};

/** Multi-select with removable pills and optional create-on-type. */
export function MultiSelect({ options, value, onChange, createOption, placeholder, inputClassName }: MultiSelectProps) {
  const selectedSet = new Set(value);

  const availableOptions = useMemo(
    () => options.filter(o => !selectedSet.has(o.id)).map(o => ({ id: o.id, value: o.value })),
    [options, value],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(id => {
            const label = String(options.find(o => o.id === id)?.value ?? id);
            return (
              <Pill
                key={id}
                label={label}
                color="var(--accent)"
                onRemove={() => onChange(value.filter(v => v !== id))}
              />
            );
          })}
        </div>
      )}
      <SearchableSelect
        options={availableOptions}
        onChange={item => {
          if (item && !selectedSet.has(item.id)) {
            onChange([...value, item.id]);
          }
        }}
        fuse
        placeholder={
          value.length === 0
            ? placeholder
            : placeholder
              ? `Add another ${placeholder.toLowerCase()}...`
              : 'Add another...'
        }
        createOption={
          createOption
            ? {
                ...createOption,
                onCreate: (query: string) => {
                  const trimmed = query.trim();
                  if (trimmed) {
                    createOption.onCreate(trimmed);
                  }
                },
              }
            : undefined
        }
        closeOnChange
        inputClassName={cn(
          'border-b-0 py-0 text-[13px] font-medium text-[var(--text)] placeholder:text-[var(--subtle)]',
          inputClassName,
        )}
      />
    </div>
  );
}
