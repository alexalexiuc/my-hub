import { z } from 'zod';
import { created, route, routeHttpError } from '@/lib/api/route';
import { isoDateSchema } from '@/lib/schemas/common';
import { addPortfolioNote, getPortfolio, getPortfolioNotes, getUserActiveBudget } from '@my-hub/shared/services';
import { PortfolioNoteKinds, type PortfolioNoteKind } from '@my-hub/shared/constants';
import type { FinancePortfolioNote } from '@my-hub/shared/types';

export type PortfolioNotesResponse = { notes: FinancePortfolioNote[] };

const NOTE_KINDS = Object.values(PortfolioNoteKinds) as [PortfolioNoteKind, ...PortfolioNoteKind[]];

export const noteBodySchema = z.object({
  date: isoDateSchema,
  kind: z.enum(NOTE_KINDS).default(PortfolioNoteKinds.Note),
  title: z.string().nullish(),
  body: z.string().trim().min(1, 'A note needs some text.'),
});

async function requirePortfolio(userId: string) {
  const budget = await getUserActiveBudget(userId);
  if (!budget) routeHttpError(404, { error: 'No budget found' });
  const portfolio = await getPortfolio(userId, budget.id);
  if (!portfolio) routeHttpError(404, { error: 'Portfolio not found' });
  return { budget, portfolio };
}

export const GET = route({ query: z.object({ q: z.string().optional(), kind: z.enum(NOTE_KINDS).optional() }) })(
  async ({ user, query }) => {
    const { budget, portfolio } = await requirePortfolio(user.id);
    const notes = await getPortfolioNotes(user.id, budget.id, portfolio.id, { query: query.q, kind: query.kind });
    const response: PortfolioNotesResponse = { notes };
    return response;
  },
);

export const POST = route({ body: noteBodySchema })(async ({ user, body }) => {
  const { budget, portfolio } = await requirePortfolio(user.id);
  const note = await addPortfolioNote(user.id, budget.id, portfolio.id, body);
  return created({ note });
});
