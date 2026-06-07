import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { createWeeklyMenu, getWeeklyMenus, getCalorieProfile } from '@my-hub/shared/services';
import { MealTypesValues, DaysOfWeekValues } from '@my-hub/shared/constants';

const MenuMealSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(MealTypesValues),
  description: z.string().trim().min(1),
  kcal: z.number().int().positive().optional(),
  protein: z.number().positive().optional(),
  carbs: z.number().positive().optional(),
  fat: z.number().positive().optional(),
});

const CreateMenuSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
  title: z.string().optional(),
  notes: z.string().optional(),
  meals: z.array(MenuMealSchema).min(1),
});

export const GET = route(async ({ user }) => {
  const [menus, profile] = await Promise.all([getWeeklyMenus(user.id), getCalorieProfile(user.id)]);
  const gymDays: number[] = (profile?.gymDays as number[] | null) ?? [];
  return { menus, gymDays };
});

export const POST = route({ body: CreateMenuSchema })(async ({ user, body }) => {
  const menu = await createWeeklyMenu({
    userId: user.id,
    weekStart: body.weekStart,
    title: body.title ?? null,
    notes: body.notes ?? null,
    meals: body.meals.map(m => ({
      dayOfWeek: m.dayOfWeek as (typeof DaysOfWeekValues)[number],
      mealType: m.mealType,
      description: m.description,
      kcal: m.kcal ?? null,
      protein: m.protein ?? null,
      carbs: m.carbs ?? null,
      fat: m.fat ?? null,
    })),
  });
  return created({ menu });
});
