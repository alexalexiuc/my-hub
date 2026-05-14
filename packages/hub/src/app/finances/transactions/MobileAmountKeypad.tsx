'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components';

type MobileAmountKeypadProps = {
  onKey: (key: string) => void;
  onDone: () => void;
  onCancel: () => void;
};

const ROWS = [
  ['+', '-', '='],
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'Backspace'],
] as const;

const OPERATOR_KEYS = new Set(['+', '-', '=']);

function KeypadButton({ label, onPress, className }: { label: string; onPress: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="transparent"
      size="md"
      onPointerDown={e => {
        e.preventDefault(); // prevent focus loss from the modal
        onPress();
      }}
      className={cn(
        'flex flex-1 items-center justify-center rounded-[10px] py-4 text-lg font-medium text-[var(--fin-text)] active:opacity-60',
        'bg-[var(--fin-card2)]',
        className,
      )}
    >
      {label === 'Backspace' ? '⌫' : label}
    </Button>
  );
}

export const MobileAmountKeypad = memo(function MobileAmountKeypad({
  onKey,
  onDone,
  onCancel,
}: MobileAmountKeypadProps) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-2">
          {row.map(key => (
            <KeypadButton
              key={key}
              label={key}
              onPress={() => onKey(key)}
              className={OPERATOR_KEYS.has(key) ? 'font-bold text-[var(--fin-accent)]' : undefined}
            />
          ))}
        </div>
      ))}
      <div className="mt-1 flex gap-2">
        <Button
          type="button"
          variant="transparent"
          size="sm"
          onPointerDown={e => {
            e.preventDefault();
            onCancel();
          }}
          className="flex-1 rounded-[10px] py-3.5 text-sm font-medium text-[var(--fin-muted)] active:opacity-60"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="transparent"
          size="sm"
          onPointerDown={e => {
            e.preventDefault();
            onDone();
          }}
          className="flex-[2] rounded-[10px] py-3.5 text-sm font-semibold text-white active:opacity-80"
          style={{ background: 'var(--fin-accent)' }}
        >
          Done
        </Button>
      </div>
    </div>
  );
});
