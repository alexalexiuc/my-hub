import { route, created } from '@/lib/api/route';
import { createWeeklyMenu, getWeeklyMenus, getCalorieProfile, getMeasurements } from '@my-hub/shared/services';
import { profileToTargets } from '@my-hub/shared/utils';
import { MeasurementTypes, DEFAULT_GYM_DAY_CALORIE_BONUS } from '@my-hub/shared/constants';
import { CreateMenuSchema, CreateMenuResponseSchema, GetMenusResponseSchema } from './menu.schemas';

export const GET = route({ response: GetMenusResponseSchema })(async ({ user }) => {
  const [menus, profile, latestWeight] = await Promise.all([
    getWeeklyMenus(user.id),
    getCalorieProfile(user.id),
    getMeasurements(user.id, { typeKey: MeasurementTypes.Weight, limit: 1 }),
  ]);
  const gymDays = profile?.gymDays ?? [];
  const weightKg = latestWeight[0]?.value ?? null;

  const targets = profileToTargets(profile, weightKg);

  return {
    menus,
    gymDays,
    goalCalories: targets.goalCalories,
    gymDayCalorieBonus: profile?.gymDayCalorieBonus ?? DEFAULT_GYM_DAY_CALORIE_BONUS,
  };
});

export const POST = route({ body: CreateMenuSchema, response: CreateMenuResponseSchema })(async ({ user, body }) => {
  const menu = await createWeeklyMenu({
    userId: user.id,
    weekStart: body.weekStart,
    title: body.title ?? null,
    notes: body.notes ?? null,
    meals: body.meals.map(m => ({
      dayOfWeek: m.dayOfWeek,
      mealType: m.mealType,
      description: m.description,
      ingredients: m.ingredients ?? null,
      kcal: m.kcal ?? null,
      protein: m.protein ?? null,
      carbs: m.carbs ?? null,
      fat: m.fat ?? null,
    })),
    shoppingList: body.shoppingList,
  });
  return created({ menu });
});
