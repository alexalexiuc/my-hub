/**
 * Investment portfolio service — ETF tracking with supply events and EOD analytics
 * - getPortfolio(userId, budgetId) — first portfolio for the budget (v1: single per budget), null if none
 * - createPortfolio(userId, budgetId, settings, positions) — creates portfolio + initial positions
 * - updatePortfolioSettings(userId, budgetId, portfolioId, data) — partial settings update
 * - getPositions(userId, budgetId, portfolioId) — positions ordered by sortOrder
 * - upsertPositions(userId, budgetId, portfolioId, positions) — insert (no id) or update (id) positions
 * - deletePosition(userId, budgetId, positionId) — throws if the position has recorded buys
 * - addSupply(userId, budgetId, portfolioId, data) — insert supply header + lines; backfills prices best-effort
 * - updateSupply(userId, budgetId, supplyId, data) — update header, replace lines atomically
 * - deleteSupply(userId, budgetId, supplyId) — delete supply event (lines cascade)
 * - getSupplies(userId, budgetId, portfolioId) — supply events with lines, date descending
 * - getPortfolioOverview(userId, budgetId) — per-position + total analytics (value, profit, allocations)
 * - getPortfolioValueHistory(userId, budgetId, portfolioId) — daily {date, value, invested} series
 * - buildPortfolioOverview(...) / buildValueHistory(...) — pure builders, exported for unit tests
 * Types: PortfolioSettingsUpdate, PositionUpsert, SupplyLineInput, SupplyInput, SupplyWithLines,
 *        PositionOverview, PortfolioOverview, PortfolioHistoryPoint
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  financePortfolios,
  financePortfolioPositions,
  financePortfolioSupplies,
  financePortfolioSupplyLines,
} from '../../db/schema/finances';
import type { SupportedCurrency } from '../../constants/finances';
import type {
  FinancePortfolio,
  FinancePortfolioPosition,
  FinancePortfolioSupply,
  FinancePortfolioSupplyLine,
} from '../../types';
import { addDays, currentDateString, logger, omitUndefined, toUTCDateStr } from '../../utils';
import { enforceBudgetAccess } from './budgets';
import { getExchangeRate } from './exchangeRates';
import {
  ensureTickerPriceHistory,
  getCachedTickerPrices,
  getLatestTickerPrice,
  type TickerPriceRow,
} from './tickerPrices';

export type PortfolioSettingsUpdate = Partial<
  Pick<
    FinancePortfolio,
    | 'name'
    | 'baseCurrency'
    | 'pessimisticAnnualReturnPct'
    | 'expectedAnnualReturnPct'
    | 'optimisticAnnualReturnPct'
    | 'plannedMonthlyContribution'
    | 'targetAmount'
  >
>;

export interface PositionUpsert {
  /** Present = update existing position, absent = insert a new one. */
  id?: number;
  symbol: string;
  name?: string | null;
  yahooSymbol: string;
  stooqSymbol?: string | null;
  currency?: SupportedCurrency;
  targetAllocationPct: number;
  sortOrder?: number;
}

export interface SupplyLineInput {
  positionId: number;
  units: number;
  pricePerUnit: number;
  fee: number;
}

export interface SupplyInput {
  date: string; // YYYY-MM-DD
  totalAmount: number;
  notes?: string | null;
  lines: SupplyLineInput[];
}

export interface SupplyLineWithPosition extends FinancePortfolioSupplyLine {
  symbol: string;
}

export interface SupplyWithLines extends FinancePortfolioSupply {
  lines: SupplyLineWithPosition[];
}

export interface PositionOverview {
  positionId: number;
  symbol: string;
  name: string | null;
  /** Price-source config — exposed so the settings UI can edit positions. */
  yahooSymbol: string;
  stooqSymbol: string | null;
  units: number;
  /** Σ units × pricePerUnit, in the portfolio base currency. */
  costBasis: number;
  fees: number;
  avgUnitCost: number | null;
  /** Latest cached close in the price currency; null when no price is cached. */
  currentPrice: number | null;
  priceCurrency: SupportedCurrency | null;
  priceDate: string | null;
  currentValue: number | null;
  /** currentValue − (costBasis + fees) — the lower, fee-inclusive profit. */
  profit: number | null;
  profitPct: number | null;
  /** currentValue − costBasis — profit ignoring fees (the higher number). */
  profitExclFees: number | null;
  profitExclFeesPct: number | null;
  actualAllocationPct: number | null;
  targetAllocationPct: number;
  /** actual − target, in percentage points. */
  allocationDeviationPct: number | null;
  /** (actual − target) / target × 100; null when target is 0. */
  allocationRelativeDeviationPct: number | null;
}

export interface PortfolioOverview {
  portfolio: FinancePortfolio;
  positions: PositionOverview[];
  totals: {
    /** Σ supplies.totalAmount — cash contributed. */
    contributed: number;
    costBasis: number;
    fees: number;
    /** null until at least one position has a cached price. */
    currentValue: number | null;
    profit: number | null;
    profitPct: number | null;
    profitExclFees: number | null;
    profitExclFeesPct: number | null;
  };
  supplyCount: number;
  firstSupplyDate: string | null;
  /** Oldest priceDate among priced positions — staleness indicator for the UI. */
  pricesAsOf: string | null;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
  /** Cumulative cash contributed up to and including this date. */
  invested: number;
}

// ─── Portfolio / settings / positions ─────────────────────────────────────

export async function getPortfolio(userId: string, budgetId: number): Promise<FinancePortfolio | null> {
  await enforceBudgetAccess(userId, budgetId);
  const [portfolio] = await db
    .select()
    .from(financePortfolios)
    .where(eq(financePortfolios.budgetId, budgetId))
    .orderBy(asc(financePortfolios.id))
    .limit(1);
  return portfolio ?? null;
}

export async function createPortfolio(
  userId: string,
  budgetId: number,
  settings: PortfolioSettingsUpdate,
  positions: PositionUpsert[],
): Promise<FinancePortfolio> {
  await enforceBudgetAccess(userId, budgetId);
  const [portfolio] = await db
    .insert(financePortfolios)
    .values({ ...omitUndefined(settings), budgetId })
    .returning();
  if (!portfolio) throw new Error('Insert did not return a row');

  if (positions.length > 0) {
    await db.insert(financePortfolioPositions).values(
      positions.map((p, i) => ({
        portfolioId: portfolio.id,
        symbol: p.symbol,
        name: p.name ?? null,
        yahooSymbol: p.yahooSymbol,
        stooqSymbol: p.stooqSymbol ?? null,
        currency: p.currency ?? 'EUR',
        targetAllocationPct: p.targetAllocationPct,
        sortOrder: p.sortOrder ?? i,
      })),
    );
  }
  return portfolio;
}

export async function updatePortfolioSettings(
  userId: string,
  budgetId: number,
  portfolioId: number,
  data: PortfolioSettingsUpdate,
): Promise<FinancePortfolio> {
  await enforceBudgetAccess(userId, budgetId);
  const [portfolio] = await db
    .update(financePortfolios)
    .set({ ...omitUndefined(data), updatedAt: new Date() })
    .where(and(eq(financePortfolios.id, portfolioId), eq(financePortfolios.budgetId, budgetId)))
    .returning();
  if (!portfolio) throw new Error('Portfolio not found');
  return portfolio;
}

export async function getPositions(
  userId: string,
  budgetId: number,
  portfolioId: number,
): Promise<FinancePortfolioPosition[]> {
  await enforceBudgetAccess(userId, budgetId);
  return db
    .select()
    .from(financePortfolioPositions)
    .where(eq(financePortfolioPositions.portfolioId, portfolioId))
    .orderBy(asc(financePortfolioPositions.sortOrder), asc(financePortfolioPositions.id));
}

async function enforcePortfolioInBudget(budgetId: number, portfolioId: number): Promise<void> {
  const [row] = await db
    .select({ id: financePortfolios.id })
    .from(financePortfolios)
    .where(and(eq(financePortfolios.id, portfolioId), eq(financePortfolios.budgetId, budgetId)))
    .limit(1);
  if (!row) throw new Error('Portfolio not found');
}

export async function upsertPositions(
  userId: string,
  budgetId: number,
  portfolioId: number,
  positions: PositionUpsert[],
): Promise<FinancePortfolioPosition[]> {
  await enforceBudgetAccess(userId, budgetId);
  await enforcePortfolioInBudget(budgetId, portfolioId);

  await db.transaction(async tx => {
    for (const [i, p] of positions.entries()) {
      if (p.id != null) {
        await tx
          .update(financePortfolioPositions)
          .set(
            omitUndefined({
              symbol: p.symbol,
              name: p.name,
              yahooSymbol: p.yahooSymbol,
              stooqSymbol: p.stooqSymbol,
              currency: p.currency,
              targetAllocationPct: p.targetAllocationPct,
              sortOrder: p.sortOrder ?? i,
              updatedAt: new Date(),
            }),
          )
          .where(and(eq(financePortfolioPositions.id, p.id), eq(financePortfolioPositions.portfolioId, portfolioId)));
      } else {
        await tx.insert(financePortfolioPositions).values({
          portfolioId,
          symbol: p.symbol,
          name: p.name ?? null,
          yahooSymbol: p.yahooSymbol,
          stooqSymbol: p.stooqSymbol ?? null,
          currency: p.currency ?? 'EUR',
          targetAllocationPct: p.targetAllocationPct,
          sortOrder: p.sortOrder ?? i,
        });
      }
    }
  });

  return getPositions(userId, budgetId, portfolioId);
}

export async function deletePosition(userId: string, budgetId: number, positionId: number): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);
  const [line] = await db
    .select({ id: financePortfolioSupplyLines.id })
    .from(financePortfolioSupplyLines)
    .where(eq(financePortfolioSupplyLines.positionId, positionId))
    .limit(1);
  if (line) throw new Error('Position has recorded buys');

  await db
    .delete(financePortfolioPositions)
    .where(
      and(
        eq(financePortfolioPositions.id, positionId),
        inArray(
          financePortfolioPositions.portfolioId,
          db
            .select({ id: financePortfolios.id })
            .from(financePortfolios)
            .where(eq(financePortfolios.budgetId, budgetId)),
        ),
      ),
    );
}

// ─── Supplies ──────────────────────────────────────────────────────────────

/**
 * Best-effort price backfill for the positions involved in a supply write.
 * Never throws — the daily worker run heals missed fetches.
 */
async function backfillPricesForLines(portfolioId: number, fromDate: string, positionIds: number[]): Promise<void> {
  try {
    const positions = await db
      .select()
      .from(financePortfolioPositions)
      .where(
        and(eq(financePortfolioPositions.portfolioId, portfolioId), inArray(financePortfolioPositions.id, positionIds)),
      );
    for (const position of positions) {
      await ensureTickerPriceHistory(position, fromDate);
    }
  } catch (err) {
    logger.warn('[portfolio] Price backfill after supply write failed:', err);
  }
}

// Shared select shape for supply lines joined to their position's symbol.
const SUPPLY_LINE_COLUMNS = {
  id: financePortfolioSupplyLines.id,
  supplyId: financePortfolioSupplyLines.supplyId,
  positionId: financePortfolioSupplyLines.positionId,
  type: financePortfolioSupplyLines.type,
  units: financePortfolioSupplyLines.units,
  pricePerUnit: financePortfolioSupplyLines.pricePerUnit,
  fee: financePortfolioSupplyLines.fee,
  symbol: financePortfolioPositions.symbol,
} as const;

async function getSupplyWithLines(supplyId: number): Promise<SupplyWithLines> {
  const [supply] = await db.select().from(financePortfolioSupplies).where(eq(financePortfolioSupplies.id, supplyId));
  if (!supply) throw new Error('Supply not found');
  const lines = await db
    .select(SUPPLY_LINE_COLUMNS)
    .from(financePortfolioSupplyLines)
    .innerJoin(financePortfolioPositions, eq(financePortfolioPositions.id, financePortfolioSupplyLines.positionId))
    .where(eq(financePortfolioSupplyLines.supplyId, supplyId))
    .orderBy(asc(financePortfolioSupplyLines.id));
  return { ...supply, lines };
}

export async function addSupply(
  userId: string,
  budgetId: number,
  portfolioId: number,
  data: SupplyInput,
): Promise<SupplyWithLines> {
  await enforceBudgetAccess(userId, budgetId);
  await enforcePortfolioInBudget(budgetId, portfolioId);

  const supplyId = await db.transaction(async tx => {
    const [supply] = await tx
      .insert(financePortfolioSupplies)
      .values({ portfolioId, date: data.date, totalAmount: data.totalAmount, notes: data.notes ?? null })
      .returning({ id: financePortfolioSupplies.id });
    if (!supply) throw new Error('Insert did not return a row');
    if (data.lines.length > 0) {
      await tx.insert(financePortfolioSupplyLines).values(data.lines.map(line => ({ ...line, supplyId: supply.id })));
    }
    return supply.id;
  });

  await backfillPricesForLines(
    portfolioId,
    data.date,
    data.lines.map(l => l.positionId),
  );
  return getSupplyWithLines(supplyId);
}

async function enforceSupplyInBudget(budgetId: number, supplyId: number): Promise<FinancePortfolioSupply> {
  const [row] = await db
    .select({ supply: financePortfolioSupplies })
    .from(financePortfolioSupplies)
    .innerJoin(financePortfolios, eq(financePortfolios.id, financePortfolioSupplies.portfolioId))
    .where(and(eq(financePortfolioSupplies.id, supplyId), eq(financePortfolios.budgetId, budgetId)))
    .limit(1);
  if (!row) throw new Error('Supply not found');
  return row.supply;
}

export async function updateSupply(
  userId: string,
  budgetId: number,
  supplyId: number,
  data: SupplyInput,
): Promise<SupplyWithLines> {
  await enforceBudgetAccess(userId, budgetId);
  const existing = await enforceSupplyInBudget(budgetId, supplyId);

  await db.transaction(async tx => {
    await tx
      .update(financePortfolioSupplies)
      .set({ date: data.date, totalAmount: data.totalAmount, notes: data.notes ?? null, updatedAt: new Date() })
      .where(eq(financePortfolioSupplies.id, supplyId));
    await tx.delete(financePortfolioSupplyLines).where(eq(financePortfolioSupplyLines.supplyId, supplyId));
    if (data.lines.length > 0) {
      await tx.insert(financePortfolioSupplyLines).values(data.lines.map(line => ({ ...line, supplyId })));
    }
  });

  await backfillPricesForLines(
    existing.portfolioId,
    data.date,
    data.lines.map(l => l.positionId),
  );
  return getSupplyWithLines(supplyId);
}

export async function deleteSupply(userId: string, budgetId: number, supplyId: number): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);
  await enforceSupplyInBudget(budgetId, supplyId);
  await db.delete(financePortfolioSupplies).where(eq(financePortfolioSupplies.id, supplyId));
}

export async function getSupplies(userId: string, budgetId: number, portfolioId: number): Promise<SupplyWithLines[]> {
  await enforceBudgetAccess(userId, budgetId);
  await enforcePortfolioInBudget(budgetId, portfolioId);

  const supplies = await db
    .select()
    .from(financePortfolioSupplies)
    .where(eq(financePortfolioSupplies.portfolioId, portfolioId))
    .orderBy(desc(financePortfolioSupplies.date), desc(financePortfolioSupplies.id));
  if (supplies.length === 0) return [];

  const lines = await db
    .select(SUPPLY_LINE_COLUMNS)
    .from(financePortfolioSupplyLines)
    .innerJoin(financePortfolioPositions, eq(financePortfolioPositions.id, financePortfolioSupplyLines.positionId))
    .where(
      inArray(
        financePortfolioSupplyLines.supplyId,
        supplies.map(s => s.id),
      ),
    )
    .orderBy(asc(financePortfolioSupplyLines.id));

  const linesBySupply = new Map<number, SupplyLineWithPosition[]>();
  for (const line of lines) {
    const list = linesBySupply.get(line.supplyId) ?? [];
    list.push(line);
    linesBySupply.set(line.supplyId, list);
  }
  return supplies.map(s => ({ ...s, lines: linesBySupply.get(s.id) ?? [] }));
}

// ─── Analytics ─────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Best-effort price-cache backfill shared by the overview and history reads.
 * Fetches missing history for every position that has recorded buys (sequential
 * to respect the external API's rate limits) and returns the earliest supply
 * date plus the set of position ids with buys.
 */
async function ensureSupplyPriceHistory(
  positions: FinancePortfolioPosition[],
  supplies: SupplyWithLines[],
): Promise<{ firstSupplyDate: string | null; positionsWithBuys: Set<number> }> {
  const firstSupplyDate =
    supplies.length > 0 ? supplies.reduce((a, s) => (s.date < a ? s.date : a), supplies[0]!.date) : null;
  const positionsWithBuys = new Set(supplies.flatMap(s => s.lines.map(l => l.positionId)));
  if (firstSupplyDate) {
    for (const position of positions) {
      if (positionsWithBuys.has(position.id)) {
        await ensureTickerPriceHistory(position, firstSupplyDate);
      }
    }
  }
  return { firstSupplyDate, positionsWithBuys };
}

/**
 * Pure overview builder — exported for unit tests.
 *
 * `latestPrices` is keyed by yahooSymbol; `fxRates` is keyed by price currency
 * and maps to the portfolio base currency (identity entries may be omitted).
 * Profit semantics: profit = value − cost − fees (fee-inclusive, the lower
 * number); profitExclFees = value − cost.
 */
export function buildPortfolioOverview(
  portfolio: FinancePortfolio,
  positions: FinancePortfolioPosition[],
  supplies: SupplyWithLines[],
  latestPrices: Map<string, TickerPriceRow>,
  fxRates: Map<string, number>,
): PortfolioOverview {
  const byPosition = new Map<number, { units: number; costBasis: number; fees: number }>();
  let contributed = 0;
  let firstSupplyDate: string | null = null;
  for (const supply of supplies) {
    contributed += supply.totalAmount;
    if (firstSupplyDate === null || supply.date < firstSupplyDate) firstSupplyDate = supply.date;
    for (const line of supply.lines) {
      const acc = byPosition.get(line.positionId) ?? { units: 0, costBasis: 0, fees: 0 };
      acc.units += line.units;
      acc.costBasis += line.units * line.pricePerUnit;
      acc.fees += line.fee;
      byPosition.set(line.positionId, acc);
    }
  }

  // First pass — per-position values; allocation percentages need the total.
  const partial = positions.map(position => {
    const acc = byPosition.get(position.id) ?? { units: 0, costBasis: 0, fees: 0 };
    const price = latestPrices.get(position.yahooSymbol) ?? null;
    const fx = price ? (fxRates.get(price.currency) ?? 1) : 1;
    const currentValue = price ? acc.units * price.close * fx : null;
    return { position, acc, price, currentValue };
  });

  const totalValue = partial.reduce<number | null>(
    (sum, p) => (p.currentValue === null ? sum : (sum ?? 0) + p.currentValue),
    null,
  );

  const positionOverviews: PositionOverview[] = partial.map(({ position, acc, price, currentValue }) => {
    const costWithFees = acc.costBasis + acc.fees;
    const profit = currentValue === null ? null : currentValue - costWithFees;
    const profitExclFees = currentValue === null ? null : currentValue - acc.costBasis;
    const actualAllocationPct =
      currentValue === null || totalValue === null || totalValue === 0 ? null : (currentValue / totalValue) * 100;
    const target = position.targetAllocationPct;
    return {
      positionId: position.id,
      symbol: position.symbol,
      name: position.name,
      yahooSymbol: position.yahooSymbol,
      stooqSymbol: position.stooqSymbol,
      units: acc.units,
      costBasis: round2(acc.costBasis),
      fees: round2(acc.fees),
      avgUnitCost: acc.units > 0 ? acc.costBasis / acc.units : null,
      currentPrice: price?.close ?? null,
      priceCurrency: price?.currency ?? null,
      priceDate: price?.date ?? null,
      currentValue: currentValue === null ? null : round2(currentValue),
      profit: profit === null ? null : round2(profit),
      profitPct: profit === null || costWithFees === 0 ? null : round2((profit / costWithFees) * 100),
      profitExclFees: profitExclFees === null ? null : round2(profitExclFees),
      profitExclFeesPct:
        profitExclFees === null || acc.costBasis === 0 ? null : round2((profitExclFees / acc.costBasis) * 100),
      actualAllocationPct: actualAllocationPct === null ? null : round2(actualAllocationPct),
      targetAllocationPct: target,
      allocationDeviationPct: actualAllocationPct === null ? null : round2(actualAllocationPct - target),
      allocationRelativeDeviationPct:
        actualAllocationPct === null || target === 0 ? null : round2(((actualAllocationPct - target) / target) * 100),
    };
  });

  const totalCostBasis = positionOverviews.reduce((s, p) => s + p.costBasis, 0);
  const totalFees = positionOverviews.reduce((s, p) => s + p.fees, 0);
  const totalCostWithFees = totalCostBasis + totalFees;
  const totalProfit = totalValue === null ? null : totalValue - totalCostWithFees;
  const totalProfitExclFees = totalValue === null ? null : totalValue - totalCostBasis;
  const pricedDates = positionOverviews.map(p => p.priceDate).filter((d): d is string => d !== null);

  return {
    portfolio,
    positions: positionOverviews,
    totals: {
      contributed: round2(contributed),
      costBasis: round2(totalCostBasis),
      fees: round2(totalFees),
      currentValue: totalValue === null ? null : round2(totalValue),
      profit: totalProfit === null ? null : round2(totalProfit),
      profitPct:
        totalProfit === null || totalCostWithFees === 0 ? null : round2((totalProfit / totalCostWithFees) * 100),
      profitExclFees: totalProfitExclFees === null ? null : round2(totalProfitExclFees),
      profitExclFeesPct:
        totalProfitExclFees === null || totalCostBasis === 0
          ? null
          : round2((totalProfitExclFees / totalCostBasis) * 100),
    },
    supplyCount: supplies.length,
    firstSupplyDate,
    pricesAsOf: pricedDates.length > 0 ? pricedDates.reduce((a, b) => (a < b ? a : b)) : null,
  };
}

/**
 * Pure daily-history builder — exported for unit tests.
 *
 * Iterates calendar days from the earliest supply date to `today`. Per
 * position, cumulative units advance on each supply date; per symbol, the
 * last close ≤ the current day is forward-filled. Days before the first
 * cached price are seeded with the position's earliest buy price so the
 * curve starts at cost rather than zero.
 *
 * FX simplification: one rate per currency (today's), not per-day rates —
 * all v1 tickers are EUR-listed so this is a no-op in practice.
 */
export function buildValueHistory(
  supplies: SupplyWithLines[],
  positions: FinancePortfolioPosition[],
  pricesBySymbol: Map<string, TickerPriceRow[]>,
  fxRates: Map<string, number>,
  today: string,
): PortfolioHistoryPoint[] {
  if (supplies.length === 0) return [];
  const suppliesAsc = [...supplies].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const firstDate = suppliesAsc[0]!.date;
  if (firstDate > today) return [];

  interface PositionCursor {
    yahooSymbol: string;
    buys: { date: string; units: number; pricePerUnit: number }[];
    buyIdx: number;
    cumUnits: number;
    prices: TickerPriceRow[];
    priceIdx: number;
    lastClose: number | null;
    fx: number;
  }

  const cursors = new Map<number, PositionCursor>();
  for (const position of positions) {
    const prices = pricesBySymbol.get(position.yahooSymbol) ?? [];
    const fxCurrency = prices[0]?.currency ?? position.currency;
    cursors.set(position.id, {
      yahooSymbol: position.yahooSymbol,
      buys: [],
      buyIdx: 0,
      cumUnits: 0,
      prices,
      priceIdx: 0,
      lastClose: null,
      fx: fxRates.get(fxCurrency) ?? 1,
    });
  }
  for (const supply of suppliesAsc) {
    for (const line of supply.lines) {
      cursors.get(line.positionId)?.buys.push({
        date: supply.date,
        units: line.units,
        pricePerUnit: line.pricePerUnit,
      });
    }
  }

  const points: PortfolioHistoryPoint[] = [];
  let invested = 0;
  let supplyIdx = 0;
  let day = firstDate;
  while (day <= today) {
    while (supplyIdx < suppliesAsc.length && suppliesAsc[supplyIdx]!.date <= day) {
      invested += suppliesAsc[supplyIdx]!.totalAmount;
      supplyIdx++;
    }

    let value = 0;
    for (const cursor of cursors.values()) {
      while (cursor.buyIdx < cursor.buys.length && cursor.buys[cursor.buyIdx]!.date <= day) {
        const buy = cursor.buys[cursor.buyIdx]!;
        cursor.cumUnits += buy.units;
        // Seed the price with the buy price until a cached close exists, so
        // the curve starts at cost instead of zero.
        if (cursor.lastClose === null) cursor.lastClose = buy.pricePerUnit;
        cursor.buyIdx++;
      }
      while (cursor.priceIdx < cursor.prices.length && cursor.prices[cursor.priceIdx]!.date <= day) {
        cursor.lastClose = cursor.prices[cursor.priceIdx]!.close;
        cursor.priceIdx++;
      }
      if (cursor.cumUnits > 0 && cursor.lastClose !== null) {
        value += cursor.cumUnits * cursor.lastClose * cursor.fx;
      }
    }

    points.push({ date: day, value: round2(value), invested: round2(invested) });
    day = toUTCDateStr(addDays(new Date(`${day}T00:00:00Z`), 1));
  }
  return points;
}

/**
 * Returns the analytics overview for the budget's portfolio, or null when no
 * portfolio exists. Ensures price history is current (best-effort) before
 * reading latest prices.
 */
export async function getPortfolioOverview(userId: string, budgetId: number): Promise<PortfolioOverview | null> {
  const portfolio = await getPortfolio(userId, budgetId);
  if (!portfolio) return null;

  const positions = await getPositions(userId, budgetId, portfolio.id);
  const supplies = await getSupplies(userId, budgetId, portfolio.id);

  await ensureSupplyPriceHistory(positions, supplies);

  // Latest-price lookups are independent DB reads — fetch them in parallel.
  const distinctSymbols = [...new Set(positions.map(p => p.yahooSymbol))];
  const latestRows = await Promise.all(distinctSymbols.map(symbol => getLatestTickerPrice(symbol)));
  const latestPrices = new Map<string, TickerPriceRow>();
  distinctSymbols.forEach((symbol, i) => {
    const price = latestRows[i];
    if (price) latestPrices.set(symbol, price);
  });

  const fxRates = new Map<string, number>();
  for (const price of latestPrices.values()) {
    if (price.currency !== portfolio.baseCurrency && !fxRates.has(price.currency)) {
      fxRates.set(price.currency, await getExchangeRate(price.currency, portfolio.baseCurrency, price.date));
    }
  }

  return buildPortfolioOverview(portfolio, positions, supplies, latestPrices, fxRates);
}

/**
 * Returns the daily {date, value, invested} series from the first supply date
 * to today. Ensures price history is current (best-effort) before reading.
 */
export async function getPortfolioValueHistory(
  userId: string,
  budgetId: number,
  portfolioId: number,
): Promise<PortfolioHistoryPoint[]> {
  await enforceBudgetAccess(userId, budgetId);
  await enforcePortfolioInBudget(budgetId, portfolioId);

  const [portfolio] = await db.select().from(financePortfolios).where(eq(financePortfolios.id, portfolioId));
  if (!portfolio) return [];
  const positions = await getPositions(userId, budgetId, portfolioId);
  const supplies = await getSupplies(userId, budgetId, portfolioId);
  if (supplies.length === 0) return [];

  const today = currentDateString();
  const { firstSupplyDate, positionsWithBuys } = await ensureSupplyPriceHistory(positions, supplies);
  if (!firstSupplyDate) return [];

  const pricesBySymbol = new Map<string, TickerPriceRow[]>();
  for (const position of positions) {
    if (!positionsWithBuys.has(position.id) || pricesBySymbol.has(position.yahooSymbol)) continue;
    pricesBySymbol.set(position.yahooSymbol, await getCachedTickerPrices(position.yahooSymbol, firstSupplyDate, today));
  }

  const fxRates = new Map<string, number>();
  for (const prices of pricesBySymbol.values()) {
    const currency = prices[0]?.currency;
    if (currency && currency !== portfolio.baseCurrency && !fxRates.has(currency)) {
      fxRates.set(currency, await getExchangeRate(currency, portfolio.baseCurrency, today));
    }
  }

  return buildValueHistory(supplies, positions, pricesBySymbol, fxRates, today);
}
