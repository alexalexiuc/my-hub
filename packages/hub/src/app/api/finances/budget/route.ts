import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  getUserBudgets,
  getBudgetMembers,
  updateBudget,
  deleteBudget,
  removeBudgetMember,
} from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const members = await getBudgetMembers(user.id, budget.id);

  return NextResponse.json({
    budget: {
      id: budget.id,
      name: budget.name,
      defaultCurrency: budget.defaultCurrency,
      createdByUserId: budget.createdByUserId,
    },
    members: members.map(m => ({ userId: m.userId, email: m.email, name: m.name, joinedAt: m.joinedAt })),
  });
});

export const PATCH = withAuth(async ({ req, user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, defaultCurrency } = body as { name?: string; defaultCurrency?: string };
  const updated = await updateBudget(user.id, budget.id, {
    ...(name ? { name: name.trim() } : {}),
    ...(defaultCurrency ? { defaultCurrency: defaultCurrency.trim().toUpperCase() } : {}),
  });

  return NextResponse.json({ budget: updated });
});

export const DELETE = withAuth(async ({ req, user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { removeMemberUserId } = body as { removeMemberUserId?: string };

  if (removeMemberUserId) {
    await removeBudgetMember(user.id, budget.id, removeMemberUserId);
    return NextResponse.json({ ok: true });
  }

  await deleteBudget(user.id, budget.id);
  return NextResponse.json({ ok: true });
});
