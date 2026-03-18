import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { deleteMeal, updateMeal } from '@my-hub/shared/services';
import { z } from 'zod';

const MealUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  kcal: z.coerce.number().optional(),
  protein: z.coerce.number().optional(),
  carbs: z.coerce.number().optional(),
  fat: z.coerce.number().optional(),
  mealType: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ mealId: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mealId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = MealUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: result.error.format() },
      { status: 400 },
    );
  }

  const updated = await updateMeal(user.id, mealId, result.data);
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
