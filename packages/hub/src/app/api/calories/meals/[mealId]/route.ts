import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { deleteMeal, updateMeal } from '@my-hub/shared/services';

export async function PATCH(req: Request, { params }: { params: Promise<{ mealId: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mealId } = await params;
  const body = await req.json();
  const updated = await updateMeal(user.id, mealId, {
    description: body.description,
    kcal: body.kcal,
    protein: body.protein,
    carbs: body.carbs,
    fat: body.fat,
    mealType: body.mealType,
    notes: body.notes,
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ meal: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ mealId: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mealId } = await params;
  const deleted = await deleteMeal(user.id, mealId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
