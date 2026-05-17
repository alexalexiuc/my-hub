'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components';

type MobileAmountKeypadProps = {
  onKey: (key: string) => void;
  onDone: () => void;
  onCancel: () => void;
  expressionText?: string;
  expressionResult?: number | null;
  currencySymbol?: string;
};

const OPERATOR_ROW = ['+', '-', '='] as const;
const DIGIT_ROWS = [
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

export function MobileAmountKeypad({
  onKey,
  onDone,
  onCancel,
  expressionText,
  expressionResult,
  currencySymbol = '',
}: MobileAmountKeypadProps) {
  const formattedResult =
    expressionResult != null
      ? currencySymbol +
        expressionResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null;

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {/* Operator row */}
      <div className="flex gap-1.5">
        {OPERATOR_ROW.map(key => (
          <KeypadButton
            key={key}
            label={key}
            onPress={() => onKey(key)}
            className="font-bold text-[var(--fin-accent)]"
          />
        ))}
      </div>

      {/* Expression strip — only shown when an expression is being built */}
      {expressionText && (
        <div className="flex items-center gap-2 rounded-[8px] bg-[var(--fin-card2)] px-3 py-1">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="whitespace-nowrap text-right text-[11px] text-[var(--fin-muted)]">{expressionText}</p>
          </div>
          {formattedResult && (
            <span className="shrink-0 text-[11px] font-semibold text-[var(--fin-accent)]">= {formattedResult}</span>
          )}
        </div>
      )}

      {/* Digit rows */}
      {DIGIT_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">
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

      {/* Cancel / Done */}
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="transparent"
          size="sm"
          onPointerDown={e => {
            e.preventDefault();
            onCancel();
          }}
          className="flex-1 rounded-[10px] py-2.5 text-sm font-medium text-[var(--fin-muted)] active:opacity-60"
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
          className="flex-[2] rounded-[10px] py-2.5 text-sm font-semibold text-white active:opacity-80"
          style={{ background: 'var(--fin-accent)' }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
