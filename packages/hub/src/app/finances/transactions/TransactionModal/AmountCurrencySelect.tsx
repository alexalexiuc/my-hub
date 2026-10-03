'use client';

import { cn } from '@/lib/utils';
import { Select } from '@/components';
import { CURRENCY_SELECT_OPTIONS } from '../../finances.utils';

type AmountCurrencySelectProps = {
  value: string | null;
  onChange: (currency: string) => void;
  className?: string;
};

/** Compact currency picker for the amount — defaults to the account currency. */
export function AmountCurrencySelect({ value, onChange, className }: AmountCurrencySelectProps) {
  return (
    <Select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      options={CURRENCY_SELECT_OPTIONS}
      aria-label="Amount currency"
      className={cn('w-auto shrink-0 px-2 py-1 text-[13px]', className)}
    />
  );
}
