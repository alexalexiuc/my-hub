import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteMeal, updateMeal } from '@my-hub/shared/services';

type MealUpdateBody = {
  description?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: string;
  notes?: string;
};

export const PATCH = withAuth<{ mealId: string }>(async ({ req, user, params }) => {
  const { mealId } = await params;

  let body: MealUpdateBody;
  try {
    body = (await req.json()) as MealUpdateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data = { ...body, ...(body.kcal != null ? { kcal: Math.round(body.kcal) } : {}) };

  const updated = await updateMeal(user.id, mealId, data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ meal: updated });
});

export const DELETE = withAuth<{ mealId: string }>(async ({ user, params }) => {
  const { mealId } = await params;
  const deleted = await deleteMeal(user.id, mealId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deleted: true });
});
