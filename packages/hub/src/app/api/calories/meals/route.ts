import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getMeals, getMealsForDateRange, logMeal } from '@my-hub/shared/services';
import type { MealType } from '@my-hub/shared/constants';
import { MealTypesValues } from '@my-hub/shared/constants';
import { MealCreateSchema } from '@my-hub/shared/schemas';

function isMealType(value: string): value is MealType {
  return MealTypesValues.includes(value as MealType);
}

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? undefined;
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const mealTypeParam = searchParams.get('mealType');
  const mealType = mealTypeParam && isMealType(mealTypeParam) ? mealTypeParam : undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

  if (dateFrom && dateTo) {
    const meals = await getMealsForDateRange(user.id, dateFrom, dateTo);
    return NextResponse.json({ meals });
  }

  const meals = await getMeals(user.id, { date, mealType, limit });
  return NextResponse.json({ meals });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = MealCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const today = new Date().toISOString().split('T')[0]!;

  const meal = await logMeal({
    mealId: crypto.randomUUID(),
    userId: user.id,
    date: data.date ?? today,
    mealType: data.mealType as MealType,
    description: data.description,
    kcal: data.kcal != null ? Math.round(data.kcal) : null,
    protein: data.protein ?? null,
    carbs: data.carbs ?? null,
    fat: data.fat ?? null,
    notes: data.notes ?? null,
  });

  return NextResponse.json({ meal }, { status: 201 });
});
