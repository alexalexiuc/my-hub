/**
 * Portfolio notes — free-form journal entries (decisions, lessons, market context) attached to a portfolio.
 * Budget-scoped; rows cascade from the portfolio, so budget deletion already covers user deletion.
 */
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { financePortfolioNotes, financePortfolios } from '../../db/schema/finances';
import type { PortfolioNoteKind } from '../../constants/finances';
import type { FinancePortfolioNote } from '../../types';
import { omitUndefined, trimOrNull } from '../../utils';
import { UserInputError } from '../../utils/errors';
import { enforceBudgetAccess } from './budgets';
import { enforcePortfolioInBudget } from './portfolio';

export interface PortfolioNoteInput {
  date: string;
  kind?: PortfolioNoteKind;
  title?: string | null;
  body: string;
}

export interface PortfolioNoteFilters {
  /** Case-insensitive substring matched against title and body. */
  query?: string;
  kind?: PortfolioNoteKind;
  /** Inclusive YYYY-MM-DD bounds. */
  from?: string;
  to?: string;
  limit?: number;
}

/** Escapes LIKE wildcards so user text is matched literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, ch => `\\${ch}`);
}

/**
 * Lists portfolio notes, newest date first, optionally filtered by text, kind and date range.
 */
export async function getPortfolioNotes(
  userId: string,
  budgetId: number,
  portfolioId: number,
  filters: PortfolioNoteFilters = {},
): Promise<FinancePortfolioNote[]> {
  await enforceBudgetAccess(userId, budgetId);
  await enforcePortfolioInBudget(budgetId, portfolioId);

  const search = filters.query?.trim();
  const pattern = search ? `%${escapeLike(search)}%` : null;
  const conditions = [
    eq(financePortfolioNotes.portfolioId, portfolioId),
    filters.kind ? eq(financePortfolioNotes.kind, filters.kind) : undefined,
    filters.from ? gte(financePortfolioNotes.date, filters.from) : undefined,
    filters.to ? lte(financePortfolioNotes.date, filters.to) : undefined,
    pattern ? or(ilike(financePortfolioNotes.title, pattern), ilike(financePortfolioNotes.body, pattern)) : undefined,
  ];

  const query = db
    .select()
    .from(financePortfolioNotes)
    .where(and(...conditions))
    .orderBy(desc(financePortfolioNotes.date), desc(financePortfolioNotes.id));
  return filters.limit ? query.limit(filters.limit) : query;
}

/**
 * Adds a note to the portfolio. Throws a UserInputError when the body is blank.
 */
export async function addPortfolioNote(
  userId: string,
  budgetId: number,
  portfolioId: number,
  data: PortfolioNoteInput,
): Promise<FinancePortfolioNote> {
  await enforceBudgetAccess(userId, budgetId);
  await enforcePortfolioInBudget(budgetId, portfolioId);

  const body = trimOrNull(data.body);
  if (!body) throw new UserInputError('A note needs some text.');

  const [note] = await db
    .insert(financePortfolioNotes)
    .values({ portfolioId, date: data.date, kind: data.kind, title: trimOrNull(data.title), body })
    .returning();
  if (!note) throw new Error('Insert did not return a row');
  return note;
}

async function enforceNoteInBudget(budgetId: number, noteId: number): Promise<FinancePortfolioNote> {
  const [row] = await db
    .select({ note: financePortfolioNotes })
    .from(financePortfolioNotes)
    .innerJoin(financePortfolios, eq(financePortfolios.id, financePortfolioNotes.portfolioId))
    .where(and(eq(financePortfolioNotes.id, noteId), eq(financePortfolios.budgetId, budgetId)))
    .limit(1);
  if (!row) throw new UserInputError('Note not found.');
  return row.note;
}

/**
 * Updates the given fields of a note; omitted fields are unchanged and `title: null` clears the title.
 */
export async function updatePortfolioNote(
  userId: string,
  budgetId: number,
  noteId: number,
  data: Partial<PortfolioNoteInput>,
): Promise<FinancePortfolioNote> {
  await enforceBudgetAccess(userId, budgetId);
  await enforceNoteInBudget(budgetId, noteId);

  const body = data.body === undefined ? undefined : trimOrNull(data.body);
  if (body === null) throw new UserInputError('A note needs some text.');

  const patch = omitUndefined({
    date: data.date,
    kind: data.kind,
    title: data.title === undefined ? undefined : trimOrNull(data.title),
    body,
  });
  const [note] = await db
    .update(financePortfolioNotes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(financePortfolioNotes.id, noteId))
    .returning();
  if (!note) throw new Error('Update did not return a row');
  return note;
}

/**
 * Deletes a note. Throws a UserInputError when it does not exist in the budget.
 */
export async function deletePortfolioNote(userId: string, budgetId: number, noteId: number): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);
  await enforceNoteInBudget(budgetId, noteId);
  await db.delete(financePortfolioNotes).where(eq(financePortfolioNotes.id, noteId));
}
