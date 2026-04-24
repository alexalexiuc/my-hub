import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getUserBudgets, createGroup } from '@my-hub/shared/services';

export const POST = withAuth(async ({ req, user }) => {
  const body = await req.json();
  const { name, sortOrder } = body as { name: string; sortOrder?: number };

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const group = await createGroup(user.id, budget.id, {
    name: name.trim(),
    sortOrder: sortOrder ?? 0,
  });

  return NextResponse.json(group, { status: 201 });
});
