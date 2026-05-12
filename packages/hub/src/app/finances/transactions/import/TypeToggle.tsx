'use client';

import { TransactionTypes, type TransactionType } from '@my-hub/shared/constants';

export type TypeToggleProps = {
  value: TransactionType;
  onChange: (t: TransactionType) => void;
};

export function TypeToggle({ value, onChange }: TypeToggleProps) {
  const types = [
    { key: TransactionTypes.Expense, label: 'E' },
    { key: TransactionTypes.Income, label: 'I' },
    { key: TransactionTypes.Transfer, label: 'T' },
  ] as const;

  return (
    <div className="flex rounded-[6px] border border-[var(--fin-border)] bg-[var(--fin-card2)] p-[2px]">
      {types.map(({ key, label }) => {
        const active = value === key;
        const color =
          key === TransactionTypes.Expense
            ? 'var(--fin-red)'
            : key === TransactionTypes.Income
              ? 'var(--fin-green)'
              : 'var(--fin-blue)';
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="w-6 rounded-[4px] py-0.5 text-[10px] font-bold transition-colors cursor-pointer"
            style={active ? { background: color + '22', color } : { color: 'var(--fin-muted)' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
