import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getMeals, getMealsForDateRange, logMeal } from '@my-hub/shared/services';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? undefined;
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const mealType = searchParams.get('mealType') ?? undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

  if (dateFrom && dateTo) {
    const meals = await getMealsForDateRange(user.id, dateFrom, dateTo);
    return NextResponse.json({ meals });
  }

  const meals = await getMeals(user.id, { date, mealType, limit });
  return NextResponse.json({ meals });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { description, kcal, mealType, date, protein, carbs, fat, notes } = body as {
    description?: string;
    kcal?: number;
    mealType?: string;
    date?: string;
    protein?: number;
    carbs?: number;
    fat?: number;
    notes?: string;
  };

  if (!description || !mealType) {
    return NextResponse.json({ error: 'description and mealType are required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const meal = await logMeal({
    mealId: crypto.randomUUID(),
    userId: user.id,
    date: date ?? today,
    mealType,
    description,
    kcal: kcal ?? null,
    protein: protein ?? null,
    carbs: carbs ?? null,
    fat: fat ?? null,
    notes: notes ?? null,
  });

  return NextResponse.json({ meal }, { status: 201 });
}
