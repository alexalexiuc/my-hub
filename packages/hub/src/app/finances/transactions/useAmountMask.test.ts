import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmountMask } from './useAmountMask';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  return renderHook(() => useAmountMask());
}

// Each key gets its own act() so React flushes state and updates refs between presses.
// Batching all keys in one act() leaves rawDigitsRef stale when the operator runs.
function press(result: ReturnType<typeof setup>['result'], ...keys: string[]) {
  for (const key of keys) {
    act(() => result.current.pressKey(key));
  }
}

// ---------------------------------------------------------------------------
// displayValue
// ---------------------------------------------------------------------------

describe('displayValue', () => {
  it('is empty when no digits have been entered', () => {
    const { result } = setup();
    expect(result.current.displayValue).toBe('');
  });

  it('implicitly places the decimal 2 places from the right', () => {
    const { result } = setup();
    press(result, '1', '0', '5', '5', '6');
    expect(result.current.displayValue).toBe('105.56');
  });

  it('formats single digits with leading zeros', () => {
    const { result } = setup();
    press(result, '5');
    expect(result.current.displayValue).toBe('0.05');
  });
});

// ---------------------------------------------------------------------------
// pressKey — digits
// ---------------------------------------------------------------------------

describe('pressKey digits', () => {
  it('accumulates digits', () => {
    const { result } = setup();
    press(result, '1', '2', '3');
    expect(result.current.displayValue).toBe('1.23');
  });

  it('suppresses leading zeros', () => {
    const { result } = setup();
    press(result, '0', '0', '5');
    expect(result.current.displayValue).toBe('0.05');
  });
});

// ---------------------------------------------------------------------------
// pressKey — Backspace
// ---------------------------------------------------------------------------

describe('pressKey Backspace', () => {
  it('removes the last digit', () => {
    const { result } = setup();
    press(result, '1', '2', '3');
    press(result, 'Backspace');
    expect(result.current.displayValue).toBe('0.12');
  });

  it('clears display when all digits are removed', () => {
    const { result } = setup();
    press(result, '5');
    press(result, 'Backspace');
    expect(result.current.displayValue).toBe('');
  });
});

// ---------------------------------------------------------------------------
// pressKey — Clear
// ---------------------------------------------------------------------------

describe('pressKey Clear', () => {
  it('resets amount and expression', () => {
    const { result } = setup();
    press(result, '1', '0', '0', '+', '5', '0');
    press(result, 'Clear');
    expect(result.current.displayValue).toBe('');
    expect(result.current.tokens).toEqual([]);
    expect(result.current.expressionResult).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setFromAmount
// ---------------------------------------------------------------------------

describe('setFromAmount', () => {
  it('populates displayValue from a decimal string', () => {
    const { result } = setup();
    act(() => result.current.setFromAmount('105.56'));
    expect(result.current.displayValue).toBe('105.56');
  });

  it('clears on zero', () => {
    const { result } = setup();
    act(() => result.current.setFromAmount('0'));
    expect(result.current.displayValue).toBe('');
  });

  it('clears on negative', () => {
    const { result } = setup();
    act(() => result.current.setFromAmount('-5'));
    expect(result.current.displayValue).toBe('');
  });

  it('clears any pending expression', () => {
    const { result } = setup();
    press(result, '1', '0', '0', '+');
    act(() => result.current.setFromAmount('50'));
    expect(result.current.tokens).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// pressKey — operators and expression
// ---------------------------------------------------------------------------

describe('pressKey operators', () => {
  it('seals current digits as a term and appends the operator', () => {
    const { result } = setup();
    press(result, '1', '1', '0', '0'); // 11.00
    press(result, '+');
    expect(result.current.tokens).toEqual(['1100', '+']);
    expect(result.current.rawDigits).toBe('');
  });

  it('replaces a trailing operator when another is pressed immediately after', () => {
    const { result } = setup();
    press(result, '1', '1', '0', '0', '+');
    press(result, '-'); // change mind: subtraction instead
    expect(result.current.tokens).toEqual(['1100', '-']);
  });

  it('does nothing when operator is pressed with no digits and no prior terms', () => {
    const { result } = setup();
    press(result, '+');
    expect(result.current.tokens).toEqual([]);
    expect(result.current.displayValue).toBe('');
  });
});

// ---------------------------------------------------------------------------
// pressKey — '=' evaluation
// ---------------------------------------------------------------------------

describe('pressKey =', () => {
  it('computes addition', () => {
    const { result } = setup();
    press(result, '1', '1', '0', '0', '+', '2', '2', '0', '0', '=');
    expect(result.current.displayValue).toBe('33.00');
    expect(result.current.tokens).toEqual([]);
  });

  it('computes subtraction', () => {
    const { result } = setup();
    press(result, '5', '0', '0', '0', '-', '2', '0', '0', '0', '=');
    expect(result.current.displayValue).toBe('30.00');
  });

  it('chains multiple operators', () => {
    const { result } = setup();
    // 11 + 22 - 5 = 28
    press(result, '1', '1', '0', '0', '+', '2', '2', '0', '0', '-', '5', '0', '0', '=');
    expect(result.current.displayValue).toBe('28.00');
  });

  it('clamps negative results to zero', () => {
    const { result } = setup();
    press(result, '5', '0', '0', '-', '1', '0', '0', '0', '0', '=');
    expect(result.current.displayValue).toBe('0.00');
  });

  it('is a no-op when no expression is pending', () => {
    const { result } = setup();
    press(result, '5', '0', '0');
    press(result, '=');
    expect(result.current.displayValue).toBe('5.00');
    expect(result.current.tokens).toEqual([]);
  });

  it('treats missing right operand as zero when = follows an operator directly', () => {
    const { result } = setup();
    press(result, '5', '0', '0', '+', '='); // 5 + 0 = 5
    expect(result.current.displayValue).toBe('5.00');
  });
});

// ---------------------------------------------------------------------------
// expressionResult
// ---------------------------------------------------------------------------

describe('expressionResult', () => {
  it('is null when no expression is pending', () => {
    const { result } = setup();
    press(result, '5', '0', '0');
    expect(result.current.expressionResult).toBeNull();
  });

  it('updates as digits are typed into the second operand', () => {
    const { result } = setup();
    press(result, '1', '0', '0', '0', '+'); // 10.00 +
    press(result, '5', '0', '0'); // 10.00 + 5.00
    expect(result.current.expressionResult).toBeCloseTo(15, 5);
  });

  it('reflects the full chain', () => {
    const { result } = setup();
    press(result, '1', '0', '0', '0', '+', '5', '0', '0', '-', '2', '0', '0');
    // 10.00 + 5.00 - 2.00 = 13.00
    expect(result.current.expressionResult).toBeCloseTo(13, 5);
  });
});
