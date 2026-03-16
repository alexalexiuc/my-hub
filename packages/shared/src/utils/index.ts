/**
 * Return a shallow copy of `obj` with every property whose value is `null` or
 * `undefined` removed.
 *
 * The return type is `Partial<{ [K in keyof T]: NonNullable<T[K]> }>`:
 *  - Every key becomes optional (may be absent at runtime when the value was nullish).
 *  - Every value type has `null` and `undefined` stripped.
 *
 * This is compatible with `exactOptionalPropertyTypes` — absent keys are truly
 * absent rather than set to `undefined`.
 *
 * Primary use-case: map a DB row (where nullable columns have type `X | null`)
 * to a domain object without writing an `if (val != null) obj.key = val` guard
 * for every field.
 *
 * @example
 * // DB row → domain object
 * const profile: BodyProfile = {
 *   updated_at: row.updatedAt.toISOString(),
 *   ...omitNullish({
 *     name: row.name,       // string | null  →  name?: string
 *     age:  row.age,        // number | null  →  age?:  number
 *   }),
 * };
 *
 * @example
 * // Building an optional filter object
 * const filter = omitNullish({ date: input.date, mealType: input.meal_type });
 * await getMeals(userId, filter);
 */
export { calculateBMR, calculateCalorieTargets } from './calories';
export type { CalorieTargets, CalorieTargetParams } from './calories';

export function omitNullish<T extends Record<string, unknown>>(obj: T): Partial<{ [K in keyof T]: NonNullable<T[K]> }> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val != null) result[key] = val;
  }
  return result as Partial<{ [K in keyof T]: NonNullable<T[K]> }>;
}
