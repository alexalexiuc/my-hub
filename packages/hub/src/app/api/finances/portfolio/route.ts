import { z } from 'zod';
import { created, route, routeHttpError } from '@/lib/api/route';
import {
  createPortfolio,
  deletePosition,
  getPortfolio,
  getPortfolioOverview,
  getUserActiveBudget,
  updatePortfolioSettings,
  upsertPositions,
  type PortfolioOverview,
} from '@my-hub/shared/services';
import { SupportedCurrencies } from '@my-hub/shared/constants';
import { allocationsSumTo100, sumAllocations } from '@my-hub/shared/utils';

export type PortfolioOverviewResponse = {
  exists: boolean;
  overview: PortfolioOverview | null;
};

export const settingsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  baseCurrency: z.enum(SupportedCurrencies).optional(),
  pessimisticAnnualReturnPct: z.number().min(-50).max(100),
  expectedAnnualReturnPct: z.number().min(-50).max(100),
  optimisticAnnualReturnPct: z.number().min(-50).max(100),
  plannedMonthlyContribution: z.number().min(0),
});

export const positionSchema = z.object({
  id: z.number().int().positive().optional(),
  symbol: z.string().trim().min(1).max(12),
  name: z.string().trim().nullish(),
  yahooSymbol: z.string().trim().min(1),
  stooqSymbol: z.string().trim().nullish(),
  currency: z.enum(SupportedCurrencies).default('EUR'),
  targetAllocationPct: z.number().min(0).max(100),
  sortOrder: z.number().int().optional(),
});

export type PortfolioSettingsValues = z.infer<typeof settingsSchema>;
export type PortfolioPositionValues = z.infer<typeof positionSchema>;

function validatePositions(positions: PortfolioPositionValues[], ctx: z.RefinementCtx): void {
  const targets = positions.map(p => p.targetAllocationPct);
  if (!allocationsSumTo100(targets)) {
    ctx.addIssue({
      code: 'custom',
      message: `Target allocations must sum to 100% (got ${sumAllocations(targets).toFixed(2)}%)`,
    });
  }
  const symbols = positions.map(p => p.symbol.toLowerCase());
  if (new Set(symbols).size !== symbols.length) {
    ctx.addIssue({ code: 'custom', message: 'Position symbols must be unique' });
  }
}

const CreateBodySchema = z.object({
  settings: settingsSchema,
  positions: z.array(positionSchema).min(1).superRefine(validatePositions),
});

const UpdateBodySchema = z.object({
  settings: settingsSchema.partial().optional(),
  positions: z.array(positionSchema).min(1).superRefine(validatePositions).optional(),
  deletePositionIds: z.array(z.number().int().positive()).optional(),
});

async function requireBudget(userId: string) {
  const budget = await getUserActiveBudget(userId);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  return budget;
}

export const GET = route(async ({ user }) => {
  const budget = await requireBudget(user.id);
  const overview = await getPortfolioOverview(user.id, budget.id);
  const response: PortfolioOverviewResponse = { exists: overview !== null, overview };
  return response;
});

export const POST = route({ body: CreateBodySchema })(async ({ user, body }) => {
  const budget = await requireBudget(user.id);
  const existing = await getPortfolio(user.id, budget.id);
  if (existing) routeHttpError(409, { error: 'Portfolio already exists' });
  const portfolio = await createPortfolio(user.id, budget.id, body.settings, body.positions);
  return created({ portfolio });
});

export const PUT = route({ body: UpdateBodySchema })(async ({ user, body }) => {
  const budget = await requireBudget(user.id);
  let portfolio = await getPortfolio(user.id, budget.id);
  if (!portfolio) routeHttpError(404, { error: 'Portfolio not found' });

  if (body.settings) {
    portfolio = await updatePortfolioSettings(user.id, budget.id, portfolio.id, body.settings);
  }
  if (body.positions) {
    await upsertPositions(user.id, budget.id, portfolio.id, body.positions);
  }
  for (const positionId of body.deletePositionIds ?? []) {
    try {
      await deletePosition(user.id, budget.id, positionId);
    } catch (err) {
      if (err instanceof Error && err.message === 'Position has recorded buys') {
        routeHttpError(409, { error: 'Cannot delete a position with recorded buys' });
      }
      throw err;
    }
  }
  return { portfolio };
});
