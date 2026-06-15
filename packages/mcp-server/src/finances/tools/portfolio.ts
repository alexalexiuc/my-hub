import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  addSupply,
  createPortfolio,
  deleteSupply,
  getPortfolio,
  getPortfolioOverview,
  getPositions,
  getSupplies,
  getUserActiveBudget,
  updatePortfolioSettings,
  upsertPositions,
  type PositionUpsert,
} from '@my-hub/shared/services';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import { allocationsSumTo100, sumAllocations } from '@my-hub/shared/utils';
import { HandledError } from '../../shared/errors';

async function requireActiveBudget(userId: string) {
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');
  return budget;
}

// ─── finances_get_portfolio ────────────────────────────────────────────────

export const GetPortfolioSchema = z.object({
  recentSuppliesLimit: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(5)
    .describe('How many of the most recent supply events to include (0 to omit them).'),
});

export const getPortfolioTool: ToolHandler<typeof GetPortfolioSchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await requireActiveBudget(userId);

  const overview = await getPortfolioOverview(userId, budget.id);
  if (!overview) {
    return toolResponse({ exists: false, hint: 'No portfolio yet. Create one with finances_update_portfolio.' });
  }

  const supplies =
    input.recentSuppliesLimit > 0
      ? (await getSupplies(userId, budget.id, overview.portfolio.id)).slice(0, input.recentSuppliesLimit)
      : [];

  return toolResponse({
    exists: true,
    settings: {
      name: overview.portfolio.name,
      baseCurrency: overview.portfolio.baseCurrency,
      pessimisticAnnualReturnPct: overview.portfolio.pessimisticAnnualReturnPct,
      expectedAnnualReturnPct: overview.portfolio.expectedAnnualReturnPct,
      optimisticAnnualReturnPct: overview.portfolio.optimisticAnnualReturnPct,
      plannedMonthlyContribution: overview.portfolio.plannedMonthlyContribution,
    },
    positions: overview.positions,
    totals: overview.totals,
    supplyCount: overview.supplyCount,
    firstSupplyDate: overview.firstSupplyDate,
    pricesAsOf: overview.pricesAsOf,
    recentSupplies: supplies.map(s => ({
      id: s.id,
      date: s.date,
      totalAmount: s.totalAmount,
      notes: s.notes,
      lines: s.lines.map(line => ({
        symbol: line.symbol,
        units: line.units,
        pricePerUnit: line.pricePerUnit,
        fee: line.fee,
      })),
    })),
  });
};

// ─── finances_record_portfolio_supply ──────────────────────────────────────

export const RecordPortfolioSupplySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Date of the supply event in YYYY-MM-DD format.'),
  totalAmount: z
    .number()
    .positive()
    .optional()
    .describe('Cash contributed on this date. Defaults to the computed sum of lines (units × price + fee).'),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        symbol: z.string().describe('Position ticker as shown in finances_get_portfolio, e.g. SPYL.'),
        units: z.number().positive(),
        pricePerUnit: z.number().positive().describe('Price paid per unit, in the portfolio base currency.'),
        fee: z.number().min(0).default(0),
      }),
    )
    .min(1),
});

export const recordPortfolioSupplyTool: ToolHandler<typeof RecordPortfolioSupplySchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;
  const budget = await requireActiveBudget(userId);

  const portfolio = await getPortfolio(userId, budget.id);
  if (!portfolio) throw new HandledError('No portfolio yet. Create one with finances_update_portfolio first.');

  const positions = await getPositions(userId, budget.id, portfolio.id);
  const bySymbol = new Map(positions.map(p => [p.symbol.toLowerCase(), p]));

  const lines = input.lines.map(line => {
    const position = bySymbol.get(line.symbol.trim().toLowerCase());
    if (!position) {
      throw new HandledError(
        `Unknown position symbol "${line.symbol}". Valid symbols: ${positions.map(p => p.symbol).join(', ') || '(none — add positions via finances_update_portfolio)'}`,
      );
    }
    return { positionId: position.id, units: line.units, pricePerUnit: line.pricePerUnit, fee: line.fee };
  });

  const computedTotal = lines.reduce((sum, l) => sum + l.units * l.pricePerUnit + l.fee, 0);
  const supply = await addSupply(userId, budget.id, portfolio.id, {
    date: input.date,
    totalAmount: input.totalAmount ?? Math.round(computedTotal * 100) / 100,
    notes: input.notes ?? null,
    lines,
  });

  return toolResponse({
    supply: {
      id: supply.id,
      date: supply.date,
      totalAmount: supply.totalAmount,
      notes: supply.notes,
      lines: supply.lines.map(line => ({
        symbol: line.symbol,
        units: line.units,
        pricePerUnit: line.pricePerUnit,
        fee: line.fee,
      })),
    },
  });
};

// ─── finances_update_portfolio ─────────────────────────────────────────────

const PortfolioSettingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  baseCurrency: z.enum(SupportedCurrencies).optional(),
  pessimisticAnnualReturnPct: z.number().min(-50).max(100).optional(),
  expectedAnnualReturnPct: z.number().min(-50).max(100).optional(),
  optimisticAnnualReturnPct: z.number().min(-50).max(100).optional(),
  plannedMonthlyContribution: z.number().min(0).optional(),
});

export const UpdatePortfolioSchema = z.object({
  settings: PortfolioSettingsSchema.optional().describe('Partial settings update; omitted fields are unchanged.'),
  positions: z
    .array(
      z.object({
        symbol: z.string().trim().min(1).max(12).describe('Display ticker, e.g. SPYL. Used as the upsert key.'),
        name: z.string().optional().describe('Full ETF name, e.g. "SPDR S&P 500 UCITS ETF".'),
        yahooSymbol: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Yahoo Finance symbol for price lookups, e.g. SPYL.DE. Required when adding a new position.'),
        stooqSymbol: z.string().optional().describe('Stooq fallback symbol, e.g. spyl.de.'),
        currency: z.enum(SupportedCurrencies).optional().describe('Listing currency. Defaults to EUR.'),
        targetAllocationPct: z.number().min(0).max(100).optional(),
      }),
    )
    .optional()
    .describe('Positions to add or update, matched case-insensitively by symbol.'),
});

export const updatePortfolioTool: ToolHandler<typeof UpdatePortfolioSchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await requireActiveBudget(userId);

  let portfolio = await getPortfolio(userId, budget.id);
  const existing = portfolio ? await getPositions(userId, budget.id, portfolio.id) : [];
  const bySymbol = new Map(existing.map(p => [p.symbol.toLowerCase(), p]));

  const upserts: PositionUpsert[] = (input.positions ?? []).map(p => {
    const current = bySymbol.get(p.symbol.trim().toLowerCase());
    if (!current && !p.yahooSymbol) {
      throw new HandledError(`Position "${p.symbol}" does not exist yet — yahooSymbol is required to add it.`);
    }
    return {
      id: current?.id,
      symbol: current?.symbol ?? p.symbol.trim(),
      name: p.name ?? current?.name ?? null,
      yahooSymbol: p.yahooSymbol ?? current!.yahooSymbol,
      stooqSymbol: p.stooqSymbol ?? current?.stooqSymbol ?? null,
      currency: p.currency ?? current?.currency,
      targetAllocationPct: p.targetAllocationPct ?? current?.targetAllocationPct ?? 0,
      sortOrder: current?.sortOrder,
    };
  });

  // Validate allocation targets when the final position set is fully determined.
  const finalTargets = new Map(existing.map(p => [p.symbol.toLowerCase(), p.targetAllocationPct]));
  for (const u of upserts) finalTargets.set(u.symbol.toLowerCase(), u.targetAllocationPct);
  const targets = [...finalTargets.values()];
  if (targets.length > 0 && !allocationsSumTo100(targets)) {
    throw new HandledError(
      `Target allocations must sum to 100% — they sum to ${sumAllocations(targets).toFixed(2)}%. Provide targetAllocationPct values that total 100.`,
    );
  }

  if (!portfolio) {
    portfolio = await createPortfolio(userId, budget.id, input.settings ?? {}, upserts);
  } else {
    if (input.settings) {
      portfolio = await updatePortfolioSettings(userId, budget.id, portfolio.id, input.settings);
    }
    if (upserts.length > 0) {
      await upsertPositions(userId, budget.id, portfolio.id, upserts);
    }
  }

  const positions = await getPositions(userId, budget.id, portfolio.id);
  return toolResponse({
    portfolio: {
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      pessimisticAnnualReturnPct: portfolio.pessimisticAnnualReturnPct,
      expectedAnnualReturnPct: portfolio.expectedAnnualReturnPct,
      optimisticAnnualReturnPct: portfolio.optimisticAnnualReturnPct,
      plannedMonthlyContribution: portfolio.plannedMonthlyContribution,
    },
    positions: positions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      yahooSymbol: p.yahooSymbol,
      stooqSymbol: p.stooqSymbol,
      currency: p.currency,
      targetAllocationPct: p.targetAllocationPct,
    })),
  });
};

// ─── finances_delete_portfolio_supply ──────────────────────────────────────

export const DeletePortfolioSupplySchema = z.object({
  supplyId: z.number().int().positive().describe('Supply event id, as returned by finances_get_portfolio.'),
});

export const deletePortfolioSupplyTool: ToolHandler<typeof DeletePortfolioSupplySchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;
  const budget = await requireActiveBudget(userId);
  await deleteSupply(userId, budget.id, input.supplyId);
  return toolResponse({ deleted: true, supplyId: input.supplyId });
};
