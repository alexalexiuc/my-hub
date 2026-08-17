import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { getMeals, getMealsForDateRange, logMeal } from '@my-hub/shared/services';
import { MealTypesValues } from '@my-hub/shared/constants';
import { isoDateSchema } from '@/lib/schemas/common';

const MealQuerySchema = z.object({
  date: isoDateSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  mealType: z.enum(MealTypesValues).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const MealCreateSchema = z.object({
  description: z.string().trim().min(1, 'description is required'),
  mealType: z.enum(MealTypesValues),
  date: isoDateSchema.optional(),
  kcal: z.number().int().nonnegative().optional(),
  protein: z.number().nonnegative().optional(),
  carbs: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const GET = route({ query: MealQuerySchema })(async ({ user, query }) => {
  if (query.dateFrom && query.dateTo) {
    const meals = await getMealsForDateRange(user.id, query.dateFrom, query.dateTo);
    return { meals };
  }

  const meals = await getMeals(user.id, {
    date: query.date,
    mealType: query.mealType,
    limit: query.limit ?? 100,
  });
  return { meals };
});

export const POST = route({ body: MealCreateSchema })(async ({ user, body }) => {
  // Only a fallback: every caller that knows the user's day sends it, because neither UTC nor the
  // server's timezone is that day. Around midnight the two differ, so an omitted date is a guess.
  const today = new Date().toISOString().split('T')[0]!;

  const meal = await logMeal({
    mealId: crypto.randomUUID(),
    userId: user.id,
    date: body.date ?? today,
    mealType: body.mealType,
    description: body.description,
    kcal: body.kcal != null ? Math.round(body.kcal) : null,
    protein: body.protein ?? null,
    carbs: body.carbs ?? null,
    fat: body.fat ?? null,
    notes: body.notes ?? null,
  });

  return created({ meal });
});
