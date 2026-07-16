import type { z } from 'zod';
import type {
  MenuMealRecordSchema,
  WeeklyMenuSchema,
  WeeklyMenuWithoutMealsSchema,
} from '@/app/api/calories/menu/menu.schemas';

export type WeeklyMenuMeal = z.infer<typeof MenuMealRecordSchema>;
/** Full menu detail, as returned by `GET /api/calories/menu/[menuId]` — includes `meals`. */
export type WeeklyMenu = z.infer<typeof WeeklyMenuSchema>;
/** Menu list entry, as returned by `GET /api/calories/menu` — no `meals` (fetched on selection). */
export type WeeklyMenuSummary = z.infer<typeof WeeklyMenuWithoutMealsSchema>;
