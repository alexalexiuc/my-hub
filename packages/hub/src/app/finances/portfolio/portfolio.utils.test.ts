import { describe, expect, it } from 'vitest';
import {
  buildCostBuildup,
  buyPointsForPosition,
  costKey,
  dateStrToMs,
  formatHistoryTick,
  historyRangeStart,
  monthTicks,
  niceAxisMax,
  rangeCoversInception,
  sliceHistory,
  summarizeHistory,
} from './portfolio.utils';

const supplies = [
  {
    date: '2026-02-01',
    lines: [
      { positionId: 1, units: 10, pricePerUnit: 11, fee: 1 },
      { positionId: 2, units: 1, pricePerUnit: 50, fee: 0 },
    ],
  },
  { date: '2026-01-01', lines: [{ positionId: 1, units: 10, pricePerUnit: 10, fee: 2 }] },
  { date: '2026-02-01', lines: [{ positionId: 2, units: 2, pricePerUnit: 40, fee: 0 }] },
];

describe('buildCostBuildup', () => {
  it('accumulates cost incl. fees per position, oldest first, merging same-day supplies', () => {
    const points = buildCostBuildup(supplies, [1, 2], '2026-03-01');
    expect(points.map(p => p.t)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'].map(dateStrToMs));
    expect(points[0]).toMatchObject({ [costKey(1)]: 102, [costKey(2)]: 0 });
    expect(points[1]).toMatchObject({ [costKey(1)]: 213, [costKey(2)]: 130 });
    expect(points[2]).toMatchObject({ [costKey(1)]: 213, [costKey(2)]: 130 });
  });

  it('adds no end point when endDate is not after the last supply', () => {
    expect(buildCostBuildup(supplies, [1, 2], '2026-02-01')).toHaveLength(2);
    expect(buildCostBuildup([], [1], '2026-02-01')).toEqual([]);
  });
});

describe('buyPointsForPosition', () => {
  it('returns one sorted point per buy line, amount excluding fees', () => {
    expect(buyPointsForPosition(supplies, 1)).toEqual([
      { t: dateStrToMs('2026-01-01'), date: '2026-01-01', price: 10, amount: 100, units: 10 },
      { t: dateStrToMs('2026-02-01'), date: '2026-02-01', price: 11, amount: 110, units: 10 },
    ]);
    expect(buyPointsForPosition(supplies, 2)).toHaveLength(2);
  });
});

describe('axis helpers', () => {
  it('niceAxisMax rounds up to 1/2/2.5/5 × 10ⁿ', () => {
    expect(niceAxisMax(13_400)).toBe(20_000);
    expect(niceAxisMax(11_900)).toBe(20_000);
    expect(niceAxisMax(2_300)).toBe(2_500);
    expect(niceAxisMax(0)).toBe(1);
  });

  it('monthTicks returns first-of-month ticks inside the range, thinned', () => {
    const ticks = monthTicks(dateStrToMs('2025-11-20'), dateStrToMs('2026-11-15'), 6);
    expect(ticks[0]).toBe(dateStrToMs('2025-12-01'));
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks.every(t => new Date(t).getUTCDate() === 1)).toBe(true);
  });
});

describe('value history ranges', () => {
  const pts = [
    { date: '2026-01-01', value: 100, invested: 100 },
    { date: '2026-10-01', value: 150, invested: 120 },
    { date: '2026-11-01', value: 160, invested: 140 },
    { date: '2026-11-09', value: 170, invested: 140 },
  ];

  it('computes range starts', () => {
    expect(historyRangeStart('1W', '2026-11-09')).toBe('2026-11-02');
    expect(historyRangeStart('1M', '2026-03-31')).toBe('2026-02-28');
    expect(historyRangeStart('YTD', '2026-11-09')).toBe('2026-01-01');
    expect(historyRangeStart('ALL', '2026-11-09')).toBeNull();
  });

  it('slices from the last point on or before the start', () => {
    expect(sliceHistory(pts, '1W', '2026-11-09').map(p => p.date)).toEqual(['2026-11-01', '2026-11-09']);
    expect(sliceHistory(pts, '1M', '2026-11-09')[0]!.date).toBe('2026-10-01');
    expect(sliceHistory(pts, 'ALL', '2026-11-09')).toHaveLength(4);
  });

  it('separates new money from market gain', () => {
    const s = summarizeHistory(sliceHistory(pts, '1M', '2026-11-09'))!;
    expect(s.change).toBe(20);
    expect(s.deposits).toBe(20);
    expect(s.gain).toBe(0);
    expect(s.totalGain).toBe(30);
    expect(summarizeHistory([])).toBeNull();
  });

  it('measures from an empty portfolio when the range covers the whole history', () => {
    const withFees = [{ date: '2026-01-01', value: 98, invested: 100 }, ...pts.slice(1)];
    expect(rangeCoversInception(withFees, 'ALL', '2026-11-09')).toBe(true);
    expect(rangeCoversInception(withFees, '1Y', '2026-11-09')).toBe(true);
    expect(rangeCoversInception(withFees, '1M', '2026-11-09')).toBe(false);
    const s = summarizeHistory(withFees, true)!;
    expect(s.gain).toBe(s.totalGain);
    expect(s.deposits).toBe(140);
  });

  it('formats ticks by range', () => {
    expect(formatHistoryTick('2026-11-09', '1M')).toBe('9 Nov');
    expect(formatHistoryTick('2026-11-09', '1Y')).toBe("Nov '26");
  });
});
