import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteMeal, updateMeal } from '@my-hub/shared/services';
import type { MealType } from '@my-hub/shared/constants';
import { MealUpdateSchema } from '@my-hub/shared/schemas';

export const PATCH = withAuth<{ mealId: string }>(async ({ req, user, params }) => {
  const { mealId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = MealUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const update = {
    ...data,
    mealType: data.mealType as MealType | undefined,
    ...(data.kcal != null ? { kcal: Math.round(data.kcal) } : {}),
  };

  const updated = await updateMeal(user.id, mealId, update);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ meal: updated });
});

export const DELETE = withAuth<{ mealId: string }>(async ({ user, params }) => {
  const { mealId } = await params;
  const deleted = await deleteMeal(user.id, mealId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deleted: true });
});
