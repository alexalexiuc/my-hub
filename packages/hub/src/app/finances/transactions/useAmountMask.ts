import { useState, useCallback, useMemo } from 'react';

/**
 * Manages a digit-only amount input where the decimal point is implicitly
 * placed 2 digits from the right. Typing "10556" displays "105.56".
 */
export function useAmountMask() {
  const [rawDigits, setRawDigits] = useState('');

  const displayValue = useMemo(() => {
    if (!rawDigits) return '';
    return (parseInt(rawDigits, 10) / 100).toFixed(2);
  }, [rawDigits]);

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
    if (isNaN(num) || num <= 0) {
      setRawDigits('');
      return;
    }
    setRawDigits(String(Math.round(num * 100)));
  }, []);

  return { displayValue, handleKeyDown, handlePaste, setFromAmount };
}
