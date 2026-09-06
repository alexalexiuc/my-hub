/**
 * Single source of truth for the user-selectable color theme system.
 * Lives in constants (not services) so it can be safely imported by
 * Next.js client components without pulling in any Node.js-only code.
 *
 * Inventory:
 * - `THEME_HUES` — the 12 accent hues offered by the generated palette.
 * - `THEME_MOODS` — the 3 chroma/lightness "moods" applied to each hue.
 * - `THEME_SIGNATURES` — the 4 hand-preserved, non-generated presets.
 * - `ThemeHue` / `ThemeMood` / `ThemeSignatureKey` / `ThemeKey` — string-union types.
 * - `THEME_KEYS` — every valid `ThemeKey` (4 signatures + 36 `hue-mood` combos), built
 *   programmatically from `THEME_HUES` / `THEME_MOODS` / `THEME_SIGNATURES` so it can never drift.
 * - `isThemeKey` — type guard for a `ThemeKey`, backed by a `Set` for O(1) lookup.
 * - `THEME_SCOPES` / `ThemeScope` / `THEME_SCOPE_KEYS` — the areas of the app a theme can be
 *   applied to (global shell + the three themed features).
 * - `DEFAULT_THEME_BY_SCOPE` — the theme each scope falls back to before the user picks anything.
 * - `themeClassName` — maps a `ThemeKey` to its CSS class name (always ending in `-theme`).
 */

/** The 12 accent hues offered by the generated palette, in picker display order. */
export const THEME_HUES = [
  { key: 'emerald', label: 'Emerald' },
  { key: 'lime', label: 'Lime' },
  { key: 'amber', label: 'Amber' },
  { key: 'orange', label: 'Orange' },
  { key: 'rose', label: 'Rose' },
  { key: 'fuchsia', label: 'Fuchsia' },
  { key: 'violet', label: 'Violet' },
  { key: 'indigo', label: 'Indigo' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'sky', label: 'Sky' },
  { key: 'teal', label: 'Teal' },
  { key: 'slate', label: 'Slate' },
] as const;

/** The 3 chroma/lightness "moods" applied to each hue. Mood is chroma-only; the surface lightness ladder never changes. */
export const THEME_MOODS = [
  { key: 'soft', label: 'Soft', description: 'Pastel accent, near-neutral surfaces' },
  { key: 'classic', label: 'Classic', description: 'Balanced accent, gently tinted surfaces' },
  { key: 'deep', label: 'Deep', description: 'Saturated accent, richly tinted surfaces' },
] as const;

/** The 4 hand-preserved, non-generated presets — byte-for-byte the app's original palettes plus a new neutral shell default. */
export const THEME_SIGNATURES = [
  { key: 'graphite-signature', label: 'Graphite' },
  { key: 'travel-signature', label: 'Travel Emerald' },
  { key: 'finances-signature', label: 'Finances Violet' },
  { key: 'calories-signature', label: 'Calories Orange' },
] as const;

export type ThemeHue = (typeof THEME_HUES)[number]['key'];
export type ThemeMood = (typeof THEME_MOODS)[number]['key'];
export type ThemeSignatureKey = (typeof THEME_SIGNATURES)[number]['key'];

/** Every valid theme key: the 4 hand-preserved signatures, or a generated `<hue>-<mood>` combo. */
export type ThemeKey = ThemeSignatureKey | `${ThemeHue}-${ThemeMood}`;

/**
 * Every valid `ThemeKey` (4 signatures + 36 `hue-mood` combos), built programmatically from
 * `THEME_HUES` / `THEME_MOODS` / `THEME_SIGNATURES` so it can never drift from those arrays.
 */
export const THEME_KEYS: readonly ThemeKey[] = [
  ...THEME_SIGNATURES.map(signature => signature.key),
  ...THEME_HUES.flatMap(hue => THEME_MOODS.map(mood => `${hue.key}-${mood.key}` as ThemeKey)),
];

const THEME_KEY_SET = new Set<string>(THEME_KEYS);

/** Type guard for a valid `ThemeKey`. */
export function isThemeKey(value: string): value is ThemeKey {
  return THEME_KEY_SET.has(value);
}

/** The areas of the app a theme preference can be scoped to. */
export const THEME_SCOPES = [
  { key: 'global', label: 'Everything' },
  { key: 'travel', label: 'Travel' },
  { key: 'finances', label: 'Finances' },
  { key: 'calories', label: 'Calories' },
] as const;

export type ThemeScope = (typeof THEME_SCOPES)[number]['key'];
export const THEME_SCOPE_KEYS: readonly ThemeScope[] = THEME_SCOPES.map(scope => scope.key);

/** The theme each scope resolves to before the user has set any preference. */
export const DEFAULT_THEME_BY_SCOPE: Record<ThemeScope, ThemeKey> = {
  global: 'graphite-signature',
  travel: 'travel-signature',
  finances: 'finances-signature',
  calories: 'calories-signature',
};

/**
 * Maps a `ThemeKey` to its CSS class name. The class always ends in the literal suffix `-theme`
 * because `packages/hub/src/hooks/usePortalTheme.ts` matches `/\b\S+-theme\b/` to re-apply themes
 * onto portaled modals.
 */
export function themeClassName(key: ThemeKey): string {
  return `${key.replace(/-signature$/, '')}-theme`;
}
