import { route, created } from '@/lib/api/route';
import { createWeeklyMenu, getWeeklyMenus, getCalorieProfile } from '@my-hub/shared/services';
import { CreateMenuSchema, GetMenusResponseSchema, WeeklyMenuSchema } from './menu.schemas';

export const GET = route({ response: GetMenusResponseSchema })(async ({ user }) => {
  const [menus, profile] = await Promise.all([getWeeklyMenus(user.id), getCalorieProfile(user.id)]);
  const gymDays = profile?.gymDays ?? [];
  return { menus, gymDays };
});

export const POST = route({ body: CreateMenuSchema, response: WeeklyMenuSchema })(async ({ user, body }) => {
  const menu = await createWeeklyMenu({
    userId: user.id,
    weekStart: body.weekStart,
    title: body.title ?? null,
    notes: body.notes ?? null,
    meals: body.meals.map(m => ({
      dayOfWeek: m.dayOfWeek,
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
