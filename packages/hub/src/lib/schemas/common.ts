import { z } from 'zod';

/**
 * A calendar date as YYYY-MM-DD — the form every date column and date query param in this app
 * uses. Defined once so the contract and its error message cannot drift between endpoints; it
 * had been re-declared per route file, which is how two calories endpoints ended up validating
 * dates differently from a third that did not validate them at all.
 */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

/**
 * A numeric text input that may be left blank. `type="number"` only constrains what most browsers
 * let you type — it does not stop a pasted value, and a bare `z.string()` lets "abc" through as
 * `NaN`, which serialises to `null` and saves silently.
 *
 * `allowZero` because the two meal forms disagree on purpose: a logged meal may legitimately be
 * 0 kcal (water, black coffee), while a *planned* menu meal of 0 is a slot someone forgot to fill.
 */
export const optionalNumber = (label: string, { allowZero = true }: { allowZero?: boolean } = {}) =>
  z
    .string()
    .refine(
      v => v.trim() === '' || (Number.isFinite(Number(v)) && (allowZero ? Number(v) >= 0 : Number(v) > 0)),
      `${label} must be a positive number`,
    );
