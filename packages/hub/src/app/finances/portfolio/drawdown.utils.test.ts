import { describe, expect, it } from 'vitest';
import { drawdownAxis, formatDrawdown, formatPp, isDrawdownStale } from './drawdown.utils';

describe('formatDrawdown', () => {
  it('uses a typeset minus and one decimal', () => {
    expect(formatDrawdown(-0.068)).toBe('−6,8%');
    expect(formatDrawdown(0)).toBe('0,0%');
    expect(formatDrawdown(null)).toBe('—');
  });
});

describe('formatPp', () => {
  it('signs a change in percentage points', () => {
    expect(formatPp(-0.017)).toBe('−1,7 pp');
    expect(formatPp(0.004)).toBe('+0,4 pp');
    expect(formatPp(0)).toBe('0,0 pp');
  });
});

describe('drawdownAxis', () => {
  it('never goes shallower than −10% and rounds down to the step', () => {
    expect(drawdownAxis(-0.03).min).toBeCloseTo(-0.1);
    expect(drawdownAxis(-0.113).min).toBeCloseTo(-0.12);
    expect(drawdownAxis(-0.113).ticks[0]).toBe(0);
  });
});

describe('isDrawdownStale', () => {
  it('accepts the previous weekday and flags older prices', () => {
    // 2026-11-20 is a Friday: Thursday's close is fresh, Wednesday's is stale.
    expect(isDrawdownStale('2026-11-19', '2026-11-20')).toBe(false);
    expect(isDrawdownStale('2026-11-18', '2026-11-20')).toBe(true);
  });
  it('treats Friday as fresh over the weekend', () => {
    expect(isDrawdownStale('2026-11-20', '2026-11-22')).toBe(false);
  });
});
