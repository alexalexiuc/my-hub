import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { getMeals, getMealsForDateRange, logMeal } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';

const MealQuerySchema = z.object({
  date: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  mealType: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const MealCreateSchema = z.object({
  description: z.string().trim().min(1, 'description is required'),
  mealType: z.enum(MealTypesValues),
  date: z.string().optional(),
  kcal: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  notes: z.string().optional(),
});

export const GET = route({ query: MealQuerySchema })(async ({ user, query }) => {
  if (query.dateFrom && query.dateTo) {
    const meals = await getMealsForDateRange(user.id, query.dateFrom, query.dateTo);
    return { meals };
  }

  const meals = await getMeals(user.id, {
    date: query.date,
    mealType: query.mealType as MealType | undefined,
    limit: query.limit ?? 100,
  });
  return { meals };
});

export const POST = route({ body: MealCreateSchema })(async ({ user, body }) => {
  const today = new Date().toISOString().split('T')[0]!;

  const meal = await logMeal({
    mealId: crypto.randomUUID(),
    userId: user.id,
    date: body.date ?? today,
    mealType: body.mealType as MealType,
    description: body.description,
    kcal: body.kcal != null ? Math.round(body.kcal) : null,
    protein: body.protein ?? null,
    carbs: body.carbs ?? null,
    fat: body.fat ?? null,
    notes: body.notes ?? null,
  });

  return created({ meal });
});
