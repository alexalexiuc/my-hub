import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getUserThemePreferences, setUserThemePreference, clearUserThemePreference } from '@my-hub/shared/services';
import { THEME_KEYS, THEME_SCOPE_KEYS, type ThemeKey, type ThemeScope } from '@my-hub/shared/constants';

const scopeValues = THEME_SCOPE_KEYS as unknown as [string, ...string[]];
const themeKeyValues = THEME_KEYS as unknown as [string, ...string[]];

const ThemePreferencePutSchema = z.object({
  scope: z.enum(scopeValues, { error: 'Invalid theme scope' }),
  // `null` clears the override for this scope, so it falls back to global (or its own default).
  themeKey: z.enum(themeKeyValues, { error: 'Invalid theme key' }).nullable(),
});

export const GET = route(async ({ user }) => {
  const preferences = await getUserThemePreferences(user.id);
  return { preferences };
});

export const PUT = route({ body: ThemePreferencePutSchema })(async ({ user, body }) => {
  const scope = body.scope as ThemeScope;
  if (body.themeKey === null) {
    await clearUserThemePreference(user.id, scope);
  } else {
    await setUserThemePreference(user.id, scope, body.themeKey as ThemeKey);
  }
  return { ok: true };
});
