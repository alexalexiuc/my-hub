import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createBudget } from '@my-hub/shared/services';

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, defaultCurrency } = body as { name?: string; defaultCurrency?: string };
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const budget = await createBudget(user.id, {
    name: name.trim(),
    defaultCurrency: (defaultCurrency ?? 'EUR').trim().toUpperCase(),
  });

  return NextResponse.json({ budget }, { status: 201 });
});
