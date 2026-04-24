import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, getGroups, getCategories, getTransactions, createCategory } from '@my-hub/shared/services';
import { CategoryIcons } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';

const VALID_ICONS = new Set<string>(Object.values(CategoryIcons));

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const budgetId = budget.id;

  // Default to current month
  const now = new Date();
  const month = searchParams.get('month') ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = month.split('-').map(Number);
  const fromDate = `${month}-01`;
  const lastDay = new Date(year!, mon!, 0).getDate();
  const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const [groups, categories, expenseTxns] = await Promise.all([
    getGroups(user.id, budgetId),
    getCategories(user.id, budgetId),
    getTransactions(user.id, budgetId, { type: 'expense', fromDate, toDate, limit: 2000 }),
  ]);

  // Spending per category
  const spentByCategory = new Map<number, number>();
  for (const t of expenseTxns) {
    if (t.categoryId != null) {
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + parseFloat(t.amount));
    }
  }

  const catRows = categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon ?? null,
    color: c.color ?? null,
    monthlyTarget: c.monthlyTarget != null ? parseFloat(c.monthlyTarget) : null,
    spent: spentByCategory.get(c.id) ?? 0,
    groupId: c.groupId ?? null,
    sortOrder: c.sortOrder,
  }));

  const groupRows = groups.map(g => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
    categories: catRows.filter(c => c.groupId === g.id).sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const ungrouped = catRows.filter(c => c.groupId === null);
  const totalSpent = catRows.reduce((s, c) => s + c.spent, 0);

  return NextResponse.json({
    currency: budget.defaultCurrency,
    month,
    groups: groupRows,
    ungrouped,
    totalSpent,
    allCategories: catRows,
  });
});

export const POST = withAuth(async ({ req, user }) => {
  const body = await req.json();
  const { name, icon, color, monthlyTarget, groupId, sortOrder } = body as {
    name: string;
    icon?: string;
    color?: string;
    monthlyTarget?: number;
    groupId?: number;
    sortOrder?: number;
  };

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const validatedIcon: CategoryIcon | null = icon && VALID_ICONS.has(icon) ? (icon as CategoryIcon) : null;

  const category = await createCategory(user.id, budget.id, {
    name: name.trim(),
    icon: validatedIcon,
    color: color ?? null,
    monthlyTarget: monthlyTarget != null ? String(monthlyTarget) : null,
    groupId: groupId ?? null,
    sortOrder: sortOrder ?? 0,
  });

  return NextResponse.json(category, { status: 201 });
});
