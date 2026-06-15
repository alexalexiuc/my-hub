import { z } from 'zod';
import { created, route, routeHttpError } from '@/lib/api/route';
import {
  addSupply,
  getPortfolio,
  getSupplies,
  getUserActiveBudget,
  type SupplyWithLines,
} from '@my-hub/shared/services';

export type SuppliesResponse = { supplies: SupplyWithLines[] };

export const supplyBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmount: z.number().positive(),
  notes: z.string().nullish(),
  lines: z
    .array(
      z.object({
        positionId: z.number().int().positive(),
        units: z.number().positive(),
        pricePerUnit: z.number().positive(),
        fee: z.number().min(0).default(0),
      }),
    )
    .min(1),
});

export type SupplyBodyValues = z.infer<typeof supplyBodySchema>;

async function requirePortfolio(userId: string) {
  const budget = await getUserActiveBudget(userId);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  const portfolio = await getPortfolio(userId, budget.id);
  if (!portfolio) routeHttpError(404, { error: 'Portfolio not found' });
  return { budget, portfolio };
}

export const GET = route(async ({ user }) => {
  const { budget, portfolio } = await requirePortfolio(user.id);
  const supplies = await getSupplies(user.id, budget.id, portfolio.id);
  const response: SuppliesResponse = { supplies };
  return response;
});

export const POST = route({ body: supplyBodySchema })(async ({ user, body }) => {
  const { budget, portfolio } = await requirePortfolio(user.id);
  const supply = await addSupply(user.id, budget.id, portfolio.id, body);
  return created({ supply });
});
