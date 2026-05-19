import { PAYEE_RANGES, type Range } from './types';

const VALID_RANGES = new Set(PAYEE_RANGES.map(r => r.key));

export function parseRange(value: string | null): Range {
  if (value && VALID_RANGES.has(value as Range)) return value as Range;
  return '30d';
}
