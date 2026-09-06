/**
 * Per-user color theme preferences.
 *
 * Inventory:
 * - `getUserThemePreferences(userId)` — raw stored rows (only scopes the user has actually set).
 * - `resolveThemeMap(rows)` — **pure** merge of stored rows into a full `Record<ThemeScope, ThemeKey>`.
 * - `resolveUserThemes(userId)` — fetches the user's rows and resolves them via `resolveThemeMap`;
 *   a `null` userId returns `DEFAULT_THEME_BY_SCOPE` unchanged without touching the DB.
 * - `setUserThemePreference(userId, scope, themeKey)` — upsert.
 * - `clearUserThemePreference(userId, scope)` — deletes one scope's override (used by "Same as global").
 * - `deleteAllUserThemePreferences(userId)` — bulk delete, returns the row count.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { userThemePreferences } from '../../db/schema/user-theme-preferences';
import { THEME_SCOPE_KEYS, DEFAULT_THEME_BY_SCOPE, type ThemeScope, type ThemeKey } from './config';

export interface UserThemePreferenceRow {
  scope: ThemeScope;
  themeKey: ThemeKey;
}

/**
 * Returns the raw stored theme preference rows for a user — only the scopes they have
 * explicitly set. Scopes with no row are omitted (absence means "inherit").
 */
export async function getUserThemePreferences(userId: string): Promise<UserThemePreferenceRow[]> {
  const rows = await db
    .select({ scope: userThemePreferences.scope, themeKey: userThemePreferences.themeKey })
    .from(userThemePreferences)
    .where(eq(userThemePreferences.userId, userId));

  return rows;
}

/**
 * Pure resolution of stored rows into a full theme map for all scopes.
 *
 * Rules:
 * - `global` resolves to the stored global row, else `DEFAULT_THEME_BY_SCOPE.global`.
 * - Each feature scope resolves to its own stored row, else the stored **global** row, else
 *   `DEFAULT_THEME_BY_SCOPE[thatScope]`.
 *
 * This is a deliberate asymmetry: a feature with no override inherits global if global is set,
 * otherwise falls back to its OWN signature default — not to graphite.
 */
export function resolveThemeMap(rows: UserThemePreferenceRow[]): Record<ThemeScope, ThemeKey> {
  const rowMap = new Map<ThemeScope, ThemeKey>(rows.map(row => [row.scope, row.themeKey]));
  const globalTheme = rowMap.get('global') ?? DEFAULT_THEME_BY_SCOPE.global;

  const resolved = {} as Record<ThemeScope, ThemeKey>;
  for (const scope of THEME_SCOPE_KEYS) {
    if (scope === 'global') {
      resolved.global = globalTheme;
      continue;
    }
    resolved[scope] = rowMap.get(scope) ?? rowMap.get('global') ?? DEFAULT_THEME_BY_SCOPE[scope];
  }
  return resolved;
}

/**
 * Resolves the full theme map for a user. A `null` userId (unauthenticated) returns
 * `DEFAULT_THEME_BY_SCOPE` unchanged, without touching the DB.
 */
export async function resolveUserThemes(userId: string | null): Promise<Record<ThemeScope, ThemeKey>> {
  if (userId === null) {
    return DEFAULT_THEME_BY_SCOPE;
  }

  const rows = await getUserThemePreferences(userId);
  return resolveThemeMap(rows);
}

/**
 * Sets (upserts) the theme preference for a specific scope for a user.
 */
export async function setUserThemePreference(userId: string, scope: ThemeScope, themeKey: ThemeKey): Promise<void> {
  await db
    .insert(userThemePreferences)
    .values({ userId, scope, themeKey, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userThemePreferences.userId, userThemePreferences.scope],
      set: { themeKey, updatedAt: new Date() },
    });
}

/**
 * Clears a user's override for a single scope (used by "Same as global"), reverting it to
 * inherit per the `resolveThemeMap` rules.
 */
export async function clearUserThemePreference(userId: string, scope: ThemeScope): Promise<void> {
  await db
    .delete(userThemePreferences)
    .where(and(eq(userThemePreferences.userId, userId), eq(userThemePreferences.scope, scope)));
}

/**
 * Deletes all theme preferences for a user. Used by the Profile "Delete all my data" action.
 */
export async function deleteAllUserThemePreferences(userId: string): Promise<number> {
  const rows = await db
    .delete(userThemePreferences)
    .where(eq(userThemePreferences.userId, userId))
    .returning({ id: userThemePreferences.id });

  return rows.length;
}
