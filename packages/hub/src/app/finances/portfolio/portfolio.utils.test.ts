import { describe, expect, it } from 'vitest';
import {
  buildCostBuildup,
  buyPointsForPosition,
  costKey,
  dateStrToMs,
  fitAxis,
  formatAxisTick,
  monthStartDates,
  formatHistoryTick,
  historyRangeStart,
  lastBuyDate,
  monthTicks,
  niceAxisMax,
  rangeCoversInception,
  sliceHistory,
  summarizeHistory,
  zeroCrossOffset,
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
  const endingOn = (date: string) => [{ date, value: 0, invested: 0 }];

  it('computes range starts from the last point', () => {
    expect(historyRangeStart('1W', endingOn('2026-11-09'))).toBe('2026-11-02');
    expect(historyRangeStart('1M', endingOn('2026-03-31'))).toBe('2026-02-28');
    expect(historyRangeStart('YTD', endingOn('2026-11-09'))).toBe('2026-01-01');
    expect(historyRangeStart('ALL', pts)).toBeNull();
    expect(historyRangeStart('1M', [])).toBeNull();
  });

  it('finds the last buy', () => {
    expect(lastBuyDate(pts)).toBe('2026-11-01');
    expect(lastBuyDate(pts.slice(0, 1))).toBe('2026-01-01');
    expect(lastBuyDate([])).toBeNull();
    expect(historyRangeStart('LAST_BUY', pts)).toBe('2026-11-01');
  });

  it('slices from the last point on or before the start', () => {
    expect(sliceHistory(pts, '1W').map(p => p.date)).toEqual(['2026-11-01', '2026-11-09']);
    expect(sliceHistory(pts, '1M')[0]!.date).toBe('2026-10-01');
    expect(sliceHistory(pts, 'ALL')).toHaveLength(4);
    expect(sliceHistory(pts, 'LAST_BUY').map(p => p.date)).toEqual(['2026-11-01', '2026-11-09']);
  });

  it('separates new money from market gain', () => {
    const s = summarizeHistory(sliceHistory(pts, '1M'))!;
    expect(s.change).toBe(20);
    expect(s.deposits).toBe(20);
    expect(s.gain).toBe(0);
    expect(s.totalGain).toBe(30);
    expect(s.endInvested).toBe(140);
    expect(summarizeHistory(sliceHistory(pts, 'LAST_BUY'))!.deposits).toBe(0);
    expect(summarizeHistory([])).toBeNull();
  });

  it('measures from an empty portfolio when the range covers the whole history', () => {
    const withFees = [{ date: '2026-01-01', value: 98, invested: 100 }, ...pts.slice(1)];
    expect(rangeCoversInception(withFees, 'ALL')).toBe(true);
    expect(rangeCoversInception(withFees, '1Y')).toBe(true);
    expect(rangeCoversInception(withFees, '1M')).toBe(false);
    const s = summarizeHistory(withFees, true)!;
    expect(s.gain).toBe(s.totalGain);
    expect(s.deposits).toBe(140);
  });

  it('formats ticks by span', () => {
    expect(formatHistoryTick('2026-11-09', 30)).toBe('9 Nov');
    expect(formatHistoryTick('2026-11-09', 365)).toBe("Nov '26");
  });
});

describe('zeroCrossOffset', () => {
  it('places the zero line within the value span', () => {
    expect(zeroCrossOffset([10, 20])).toBe(1);
    expect(zeroCrossOffset([-10, -1])).toBe(0);
    expect(zeroCrossOffset([-10, 30])).toBe(0.75);
  });
});

describe('fitAxis', () => {
  it('hugs the data with round ticks', () => {
    expect(fitAxis(-63, 1390).ticks).toEqual([0, 500, 1000]);
    expect(fitAxis(-63, 1390).domain[0]).toBeCloseTo(-135.65);
    expect(fitAxis(10_450, 12_820).ticks).toEqual([11_000, 12_000]);
    expect(fitAxis(12_600, 12_800).ticks).toEqual([12_600, 12_650, 12_700, 12_750, 12_800]);
    expect(fitAxis(5, 5).domain).toEqual([4.975, 5.025]);
  });
});

describe('axis labels', () => {
  it('keeps small steps distinct', () => {
    expect(formatAxisTick(12_500, 500)).toBe('12.5k');
    expect(formatAxisTick(1250, 50)).toBe('1.250');
  });

  it('picks month starts', () => {
    const dates = ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02', '2026-03-01', '2026-04-01'];
    expect(monthStartDates(dates)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01']);
    expect(monthStartDates(dates, 2)).toEqual(['2026-02-01', '2026-04-01']);
  });
});
