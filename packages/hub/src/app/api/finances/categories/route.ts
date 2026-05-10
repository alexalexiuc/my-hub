import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import {
  getGroups,
  getCategories,
  getTransactions,
  createCategory,
  getUserActiveBudget,
} from '@my-hub/shared/services';
import { CategoryIcons, TransactionTypes } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';
import { categoriesResponseSchema, categoryMutationResponseSchema } from '../contracts';
import { trimOrNull } from '@my-hub/shared/utils';

const CategoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  icon: z
    .enum(Object.values(CategoryIcons) as [string, ...string[]])
    .nullable()
    .optional(),
  color: z.string().optional(),
  notes: z.string().trim().nullable().optional(),
  monthlyTarget: z.number().nonnegative().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const CategoryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM')
    .optional(),
});

export const GET = route({ query: CategoryQuerySchema, response: categoriesResponseSchema })(async ({
  user,
  query,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;

  const now = new Date();
  const month = query.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = month.split('-').map(Number);
  const fromDate = `${month}-01`;
  const lastDay = new Date(year!, mon!, 0).getDate();
  const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const [groups, categories, expenseTxns] = await Promise.all([
    getGroups(user.id, budgetId),
    getCategories(user.id, budgetId),
    getTransactions(user.id, budgetId, { type: TransactionTypes.Expense, fromDate, toDate, limit: 2000 }),
  ]);

  const spentByCategory = new Map<number, number>();
  for (const t of expenseTxns) {
    if (t.categoryId != null) {
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
    }
  }

  const catRows = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon ?? null,
    color: c.color ?? null,
    notes: c.notes ?? null,
    monthlyTarget: c.monthlyTarget ?? null,
    spent: spentByCategory.get(c.id) ?? 0,
    groupId: c.groupId ?? null,
    sortOrder: c.sortOrder,
  }));

  const groupRows = groups.map(g => ({
    id: g.id,
    name: g.name,
    notes: g.notes ?? null,
    sortOrder: g.sortOrder,
    categories: catRows.filter(c => c.groupId === g.id).sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const ungrouped = catRows.filter(c => c.groupId === null);
  const totalSpent = catRows.reduce((s, c) => s + c.spent, 0);

  return {
    currency: budget.defaultCurrency,
    month,
    groups: groupRows,
    ungrouped,
    totalSpent,
    allCategories: catRows,
  };
});

export const POST = route({ body: CategoryCreateSchema, response: categoryMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const category = await createCategory(user.id, budget.id, {
    name: body.name.trim(),
    icon: (body.icon as CategoryIcon | null | undefined) ?? null,
    color: body.color ?? null,
    notes: trimOrNull(body.notes) ?? null,
    monthlyTarget: body.monthlyTarget ?? null,
    groupId: body.groupId ?? null,
    sortOrder: body.sortOrder ?? 0,
  });

  return created(category);
});
