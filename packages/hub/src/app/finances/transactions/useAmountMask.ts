import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Evaluates a flat token array [digits, op, digits, op, ..., digits] where
 * digits are raw cent strings and op is '+' | '-'. Returns the result in dollars,
 * clamped to ≥ 0.
 */
function evaluateTokens(all: string[]): number {
  let result = parseInt(all[0]!, 10) / 100;
  for (let i = 1; i < all.length; i += 2) {
    const val = parseInt(all[i + 1] || '0', 10) / 100;
    result = all[i] === '+' ? result + val : result - val;
  }
  return Math.max(0, result);
}

/**
 * Manages a digit-only amount input where the decimal point is implicitly
 * placed 2 digits from the right. Typing "10556" displays "105.56".
 *
 * `tokens` is a flat alternating array: [digits, op, digits, op, ...]
 * where digits are raw cent strings (e.g. "1100" = 11.00) and op is '+' | '-'.
 * `rawDigits` is the current (unsealed) input being typed.
 */
export function useAmountMask() {
  const [rawDigits, setRawDigits] = useState('');
  const [tokens, setTokens] = useState<string[]>([]);

  // Refs let pressKey read current state without being recreated on every digit press.
  const rawDigitsRef = useRef(rawDigits);
  rawDigitsRef.current = rawDigits;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  const displayValue = useMemo(() => {
    if (!rawDigits) return '';
    return (parseInt(rawDigits, 10) / 100).toFixed(2);
  }, [rawDigits]);

  /** Computed running total across the full expression; null when no expression is pending. */
  const expressionResult = useMemo((): number | null => {
    if (tokens.length === 0) return null;
    return evaluateTokens([...tokens, rawDigits || '0']);
  }, [tokens, rawDigits]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      setRawDigits(prev => {
        const next = prev + e.key;
        return next.replace(/^0+(\d)/, '$1');
      });
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setRawDigits(prev => prev.slice(0, -1));
    } else if (e.key === 'Delete') {
      e.preventDefault();
      setRawDigits('');
    } else if (
      !e.ctrlKey &&
      !e.metaKey &&
      !['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    ) {
      e.preventDefault();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const cleaned = pasted.replace(/[^\d.]/g, '');
    if (cleaned.includes('.')) {
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) {
        setRawDigits(String(Math.round(num * 100)));
      }
    } else {
      const digits = cleaned.replace(/\D/g, '').replace(/^0+(\d)/, '$1');
      if (digits) setRawDigits(digits);
    }
  }, []);

  /** Populate the mask from an existing decimal amount string (e.g. when editing). */
  const setFromAmount = useCallback((amount: string) => {
    const num = parseFloat(amount);
    setTokens([]);
    if (isNaN(num) || num <= 0) {
      setRawDigits('');
      return;
    }
    setRawDigits(String(Math.round(num * 100)));
  }, []);

  /** Handle a single keypad key press from the mobile keypad. Stable reference — reads state via refs. */
  const pressKey = useCallback((key: string) => {
    if (key >= '0' && key <= '9') {
      setRawDigits(prev => (prev + key).replace(/^0+(\d)/, '$1'));
    } else if (key === 'Backspace') {
      setRawDigits(prev => prev.slice(0, -1));
    } else if (key === 'Clear') {
      setRawDigits('');
      setTokens([]);
    } else if (key === '+' || key === '-') {
      const { current } = tokensRef;
      const lastToken = current[current.length - 1];
      if ((lastToken === '+' || lastToken === '-') && !rawDigitsRef.current) {
        // Replace a trailing operator only when no digits have been started yet
        // (e.g. "11 +" then immediately "−" → "11 −")
        setTokens(prev => [...prev.slice(0, -1), key]);
      } else if (rawDigitsRef.current || current.length > 0) {
        // Seal current input as a term, append the operator
        setTokens(prev => [...prev, rawDigitsRef.current || '0', key]);
        setRawDigits('');
      }
    } else if (key === '=') {
      const { current } = tokensRef;
      if (current.length === 0) return;
      const result = evaluateTokens([...current, rawDigitsRef.current || '0']);
      setRawDigits(String(Math.round(result * 100)));
      setTokens([]);
    }
    // '.' is a no-op — decimal is implicit (2 places from right)
  }, []);

  return { displayValue, rawDigits, tokens, expressionResult, handleKeyDown, handlePaste, setFromAmount, pressKey };
}
