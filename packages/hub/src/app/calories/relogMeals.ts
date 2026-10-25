import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';
import { formToAddBody, mealToFormValues } from './meals-form.schema';

/**
 * Logs copies of `meals` onto `date`, one POST each, without the per-request toast — the caller
 * reports the outcome once. Sequential so the copies keep the source day's order.
 */
export async function relogMeals(meals: MealLog[], date: string): Promise<void> {
  for (const meal of meals) {
    await apiFetch('/api/calories/meals', {
      method: 'POST',
      body: formToAddBody(mealToFormValues(meal), date),
      silentToast: true,
    });
  }
}
