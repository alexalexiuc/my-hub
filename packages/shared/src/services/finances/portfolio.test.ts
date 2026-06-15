import { describe, expect, it } from 'vitest';
import { buildPortfolioOverview, buildValueHistory, type SupplyWithLines } from './portfolio';
import type { TickerPriceRow } from './tickerPrices';
import type { FinancePortfolio, FinancePortfolioPosition } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date('2026-01-16T00:00:00Z');

const portfolio: FinancePortfolio = {
  id: 1,
  budgetId: 1,
  name: 'Portfolio',
  baseCurrency: 'EUR',
  pessimisticAnnualReturnPct: 4,
  expectedAnnualReturnPct: 7,
  optimisticAnnualReturnPct: 10,
  plannedMonthlyContribution: 1000,
  createdAt: now,
  updatedAt: now,
};

function makePosition(id: number, symbol: string, targetAllocationPct: number): FinancePortfolioPosition {
  return {
    id,
    portfolioId: 1,
    symbol,
    name: null,
    yahooSymbol: `${symbol}.DE`,
    stooqSymbol: null,
    currency: 'EUR',
    targetAllocationPct,
    sortOrder: id,
    createdAt: now,
    updatedAt: now,
  };
}

const positionA = makePosition(1, 'AAA', 70);
const positionB = makePosition(2, 'BBB', 30);

interface LineSpec {
  positionId: number;
  symbol: string;
  units: number;
  pricePerUnit: number;
  fee: number;
}

let nextLineId = 1;
function makeSupply(id: number, date: string, totalAmount: number, lines: LineSpec[]): SupplyWithLines {
  return {
    id,
    portfolioId: 1,
    date,
    totalAmount,
    notes: null,
    createdAt: now,
    updatedAt: now,
    lines: lines.map(line => ({ id: nextLineId++, supplyId: id, type: 'buy', ...line })),
  };
}

const supplies: SupplyWithLines[] = [
  makeSupply(1, '2026-01-05', 1000, [
    { positionId: 1, symbol: 'AAA', units: 10, pricePerUnit: 50, fee: 3 },
    { positionId: 2, symbol: 'BBB', units: 5, pricePerUnit: 40, fee: 1 },
  ]),
  makeSupply(2, '2026-01-12', 500, [
    { positionId: 1, symbol: 'AAA', units: 5, pricePerUnit: 52, fee: 3 },
    { positionId: 2, symbol: 'BBB', units: 2, pricePerUnit: 41, fee: 1 },
  ]),
];

function price(symbol: string, date: string, close: number): TickerPriceRow {
  return { symbol, date, close, currency: 'EUR', source: 'yahoo' };
}

// ─── buildPortfolioOverview ───────────────────────────────────────────────────

describe('buildPortfolioOverview', () => {
  const latestPrices = new Map([
    ['AAA.DE', price('AAA.DE', '2026-01-16', 60)],
    ['BBB.DE', price('BBB.DE', '2026-01-15', 45)],
  ]);

  it('computes per-position units, cost basis, fees, value and profit (with and without fees)', () => {
    const overview = buildPortfolioOverview(portfolio, [positionA, positionB], supplies, latestPrices, new Map());
    const a = overview.positions[0]!;
    expect(a.units).toBe(15);
    expect(a.costBasis).toBe(760); // 10×50 + 5×52
    expect(a.fees).toBe(6);
    expect(a.currentValue).toBe(900); // 15 × 60
    expect(a.profit).toBe(134); // 900 − (760 + 6) — fee-inclusive is the LOWER number
    expect(a.profitExclFees).toBe(140); // 900 − 760
    expect(a.profitPct).toBeCloseTo((134 / 766) * 100, 1);

    const b = overview.positions[1]!;
    expect(b.units).toBe(7);
    expect(b.costBasis).toBe(282); // 5×40 + 2×41
    expect(b.currentValue).toBe(315); // 7 × 45
    expect(b.profit).toBe(31); // 315 − 284
  });

  it('computes allocations and deviations against targets', () => {
    const overview = buildPortfolioOverview(portfolio, [positionA, positionB], supplies, latestPrices, new Map());
    const a = overview.positions[0]!;
    expect(a.actualAllocationPct).toBeCloseTo(74.07, 2); // 900 / 1215
    expect(a.allocationDeviationPct).toBeCloseTo(4.07, 2);
    expect(a.allocationRelativeDeviationPct).toBeCloseTo(5.82, 2);
    const b = overview.positions[1]!;
    expect(b.actualAllocationPct).toBeCloseTo(25.93, 2);
    expect(b.allocationDeviationPct).toBeCloseTo(-4.07, 2);
  });

  it('computes totals, supply metadata and price staleness', () => {
    const overview = buildPortfolioOverview(portfolio, [positionA, positionB], supplies, latestPrices, new Map());
    expect(overview.totals.contributed).toBe(1500);
    expect(overview.totals.costBasis).toBe(1042);
    expect(overview.totals.fees).toBe(8);
    expect(overview.totals.currentValue).toBe(1215);
    expect(overview.totals.profit).toBe(165); // 1215 − 1050
    expect(overview.totals.profitExclFees).toBe(173); // 1215 − 1042
    expect(overview.supplyCount).toBe(2);
    expect(overview.firstSupplyDate).toBe('2026-01-05');
    expect(overview.pricesAsOf).toBe('2026-01-15'); // oldest price date
  });

  it('null-propagates value fields for unpriced positions but keeps cost math', () => {
    const onlyA = new Map([['AAA.DE', price('AAA.DE', '2026-01-16', 60)]]);
    const overview = buildPortfolioOverview(portfolio, [positionA, positionB], supplies, onlyA, new Map());
    const b = overview.positions[1]!;
    expect(b.costBasis).toBe(282);
    expect(b.currentValue).toBeNull();
    expect(b.profit).toBeNull();
    expect(b.actualAllocationPct).toBeNull();
    // Unpriced positions contribute 0 to the total value
    expect(overview.totals.currentValue).toBe(900);
  });

  it('returns null totals.currentValue when no position has a price', () => {
    const overview = buildPortfolioOverview(portfolio, [positionA, positionB], supplies, new Map(), new Map());
    expect(overview.totals.currentValue).toBeNull();
    expect(overview.totals.profit).toBeNull();
    expect(overview.pricesAsOf).toBeNull();
  });

  it('applies FX rates for non-base price currencies', () => {
    const usdPrice = new Map([['AAA.DE', { ...price('AAA.DE', '2026-01-16', 60), currency: 'USD' as const }]]);
    const overview = buildPortfolioOverview(portfolio, [positionA], supplies, usdPrice, new Map([['USD', 0.9]]));
    expect(overview.positions[0]!.currentValue).toBe(810); // 15 × 60 × 0.9
  });
});

// ─── buildValueHistory ────────────────────────────────────────────────────────

describe('buildValueHistory', () => {
  const singleSupply = [
    makeSupply(1, '2026-01-05', 503, [{ positionId: 1, symbol: 'AAA', units: 10, pricePerUnit: 50, fee: 3 }]),
  ];

  it('forward-fills weekend/holiday gaps from the last close', () => {
    const prices = new Map([
      [
        'AAA.DE',
        [price('AAA.DE', '2026-01-05', 50), price('AAA.DE', '2026-01-06', 52), price('AAA.DE', '2026-01-09', 55)],
      ],
    ]);
    const points = buildValueHistory(singleSupply, [positionA], prices, new Map(), '2026-01-09');
    expect(points.map(p => p.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']);
    expect(points.map(p => p.value)).toEqual([500, 520, 520, 520, 550]);
    expect(points.every(p => p.invested === 503)).toBe(true);
  });

  it('seeds days before the first cached price with the buy price', () => {
    const prices = new Map([['AAA.DE', [price('AAA.DE', '2026-01-07', 55)]]]);
    const points = buildValueHistory(singleSupply, [positionA], prices, new Map(), '2026-01-07');
    expect(points[0]!.value).toBe(500); // 10 × buy price 50
    expect(points[2]!.value).toBe(550);
  });

  it('accumulates invested and units across multiple supplies and positions', () => {
    const prices = new Map([
      ['AAA.DE', [price('AAA.DE', '2026-01-05', 50), price('AAA.DE', '2026-01-12', 52)]],
      ['BBB.DE', [price('BBB.DE', '2026-01-05', 40), price('BBB.DE', '2026-01-12', 41)]],
    ]);
    const points = buildValueHistory(supplies, [positionA, positionB], prices, new Map(), '2026-01-12');
    const first = points[0]!;
    expect(first.invested).toBe(1000);
    expect(first.value).toBe(10 * 50 + 5 * 40); // 700
    const last = points.at(-1)!;
    expect(last.invested).toBe(1500);
    expect(last.value).toBe(15 * 52 + 7 * 41); // 1067
  });

  it('returns [] when there are no supplies', () => {
    expect(buildValueHistory([], [positionA], new Map(), new Map(), '2026-01-09')).toEqual([]);
  });
});
