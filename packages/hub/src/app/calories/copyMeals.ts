import type { MealLog } from '@my-hub/shared/types';
import { apiFetch } from '@/lib/utils';

/**
 * Copies every meal logged on `fromDate` onto `toDate` in one transaction
 * (`POST /api/calories/meals/copy`) and returns the new entries. With `onlyIfEmpty`, the server
 * refuses with a 400 when `toDate` already has meals. No toast — callers show their own message.
 */
export async function copyMeals(fromDate: string, toDate: string, onlyIfEmpty = false): Promise<MealLog[]> {
  const { meals } = await apiFetch<{ meals: MealLog[] }>('/api/calories/meals/copy', {
    method: 'POST',
    body: { fromDate, toDate, onlyIfEmpty },
    silentToast: true,
  });
  return meals;
}
