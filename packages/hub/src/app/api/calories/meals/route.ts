import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getMeals, getMealsForDateRange, logMeal } from '@my-hub/shared/services';
import { MealTypesValues, type MealType } from '@my-hub/shared/constants';

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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { description, kcal, mealType, date, protein, carbs, fat, notes } = body as {
    description?: string;
    kcal?: number;
    mealType?: MealType;
    date?: string;
    protein?: number;
    carbs?: number;
    fat?: number;
    notes?: string;
  };

  if (!description || !mealType || !isMealType(mealType)) {
    return NextResponse.json({ error: 'description and mealType are required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const meal = await logMeal({
    mealId: crypto.randomUUID(),
    userId: user.id,
    date: date ?? today,
    mealType,
    description,
    kcal: kcal != null ? Math.round(kcal) : null,
    protein: protein ?? null,
    carbs: carbs ?? null,
    fat: fat ?? null,
    notes: notes ?? null,
  });

  return NextResponse.json({ meal }, { status: 201 });
});
