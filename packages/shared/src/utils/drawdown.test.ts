import { describe, expect, it } from 'vitest';
import { buildBasketDrawdown, drawdownLevel, rollingDrawdown } from './drawdown';

const series = (key: string, weight: number, closes: [string, number][]) => ({
  key,
  weight,
  prices: closes.map(([date, close]) => ({ date, close })),
});

describe('rollingDrawdown', () => {
  it('is 0 on a new high and negative below the window peak', () => {
    const dd = rollingDrawdown(['2026-01-01', '2026-01-02', '2026-01-03'], [100, 110, 99], 30);
    expect(dd[0]).toBe(0);
    expect(dd[1]).toBe(0);
    expect(dd[2]).toBeCloseTo(99 / 110 - 1, 10);
  });

  it('forgets a peak once it falls out of the calendar window', () => {
    const dd = rollingDrawdown(['2026-01-01', '2026-01-20', '2026-02-05'], [200, 100, 90], 30);
    // 2026-01-20 still sees the 200 peak (19 days); 2026-02-05 is 35 days after it, so the peak is 100.
    expect(dd[1]).toBeCloseTo(-0.5, 10);
    expect(dd[2]).toBeCloseTo(90 / 100 - 1, 10);
  });
});

describe('buildBasketDrawdown', () => {
  const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'];

  it('equals the single ETF drawdown when its weight is 1 and the others 0', () => {
    const spyl = series('SPYL', 1, [
      [days[0]!, 10],
      [days[1]!, 12],
      [days[2]!, 9],
      [days[3]!, 10],
    ]);
    const other = series('EXUS', 0, [
      [days[0]!, 50],
      [days[1]!, 40],
    ]);
    const points = buildBasketDrawdown([spyl, other]);
    const own = rollingDrawdown(days, [10, 12, 9, 10], 30);
    points.forEach((p, i) => expect(p.dd30).toBeCloseTo(own[i]!, 10));
  });

  it('is 0 on a new 30-day high and never positive', () => {
    const points = buildBasketDrawdown([
      series('A', 1, [
        [days[0]!, 10],
        [days[1]!, 11],
        [days[2]!, 10],
        [days[3]!, 12],
      ]),
    ]);
    expect(points[1]!.dd30).toBe(0);
    expect(points[3]!.dd30).toBe(0);
    expect(points.every(p => p.dd30 <= 0 && p.dd52 <= 0)).toBe(true);
  });

  it('carries a missing close forward without a spike', () => {
    const a = series('A', 0.5, [
      [days[0]!, 10],
      [days[1]!, 10],
      [days[2]!, 10],
    ]);
    const b = series('B', 0.5, [
      [days[0]!, 100],
      [days[2]!, 100],
    ]);
    const points = buildBasketDrawdown([a, b]);
    expect(points.map(p => p.basket)).toEqual([100, 100, 100]);
  });

  it('starts on the first day every ETF has a price', () => {
    const a = series('A', 1, [
      [days[0]!, 10],
      [days[1]!, 10],
    ]);
    const b = series('B', 1, [[days[1]!, 20]]);
    expect(buildBasketDrawdown([a, b]).map(p => p.date)).toEqual([days[1]]);
  });

  it('returns an empty series for no usable input', () => {
    expect(buildBasketDrawdown([])).toEqual([]);
    expect(buildBasketDrawdown([series('A', 0, [[days[0]!, 1]])])).toEqual([]);
  });
});

describe('drawdownLevel', () => {
  it('buckets at the configured thresholds', () => {
    expect(drawdownLevel(-0.049)).toBe('neutral');
    expect(drawdownLevel(-0.05)).toBe('amber');
    expect(drawdownLevel(-0.079)).toBe('amber');
    expect(drawdownLevel(-0.08)).toBe('red');
  });
});
