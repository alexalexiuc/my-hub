---
name: hub-theming
description: |
  Use when working on Hub colours and themes — choosing tokens for a new surface, fixing contrast, adding or
  editing a palette/signature theme, ThemePicker / appearance page, FeatureTheme, portaled modals losing their
  theme, or `gen:palettes` drift in CI. Applies to packages/hub/src/styles and themed components.
metadata:
  scope: hub
  stage: implementation
---

# Hub theming

## Tokens (CSS custom properties on a `*-theme` class)

| Group     | Tokens                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| Surfaces  | `--bg` `--overlay` `--shell` `--card` `--card2` `--card3` `--border`                                               |
| Text      | `--text` `--muted` `--subtle`                                                                                      |
| Accent    | `--accent` `--accent-d` `--accent-shadow` `--accent-hover`                                                         |
| Semantic  | `--green` `--blue` `--amber` `--red` `--violet` `--teal` `--orange` `--pink` `--emerald` `--sky` (+ `-d` variants) |
| On-colour | `--on-accent` (text on `--accent`, generated for 4.5:1), `--on-solid` (always `#ffffff`)                           |

- Text on `--accent`: `text-[var(--on-accent)]`, never `text-white` (soft Amber / soft Lime accents are light).
- Semantic tokens mean status (`--red` danger, `--green` success) — not decoration, and never swapped for the
  accent.
- `--on-solid` (white) reads on `--red`, `--blue`, `--violet`, `--teal`, but **not** on `--amber` (ever) or
  `--green` in the default signature (light mint). A solid warning CTA uses `Button variant="accent"` instead.
- Text on a strong semantic fill (≥60% mix toward `--green`/`--red`, e.g. heat-map cells): `text-[var(--bg)]` —
  semantic tokens are generated to contrast with `--bg`. Weaker fills keep `--text`.
- Data colours are not theme colours: per-trip colours, finance category swatches, `MACRO_COLORS` stay as data.
- `Card compact` = bordered callout/row without Card's mobile full-bleed.

## Theme mechanics

- A theme class **must end in `-theme`**: `usePortalTheme` copies `/\b\S+-theme\b/` onto portaled modals; another
  shape silently unthemes every modal.
- Feature subtrees: `<FeatureTheme feature="travel|finances|calories|…">` (also sets `data-feature`, which CSS
  should key off to target a feature regardless of theme) — not a literal class.
- Option list and labels: `THEME_OPTIONS`, `themeLabel`, `groupThemeOptions()` in `@my-hub/shared/constants`
  (one flat `ThemePicker` dropdown; `/appearance` gallery). Per-user choice: `user-theme-preferences` service
  (`resolveThemeMap`: feature scope → global → that feature's signature default).

## Palettes

- 36 generated palettes come from `packages/hub/scripts/gen-palettes.mts` → `src/styles/themes.generated.css` +
  `src/lib/theme-swatches.generated.ts`. Edit the generator, never the generated files, then
  `pnpm --filter @my-hub/hub gen:palettes`. `gen:palettes:report` prints the contrast matrix; CI runs
  `gen:palettes:check` and fails on drift.
- The 5 hand-authored signatures (`src/styles/*.css`) are **not** covered by the generator's assertions — check a
  new/edited signature's contrast by hand against the same thresholds.
- `light-signature` is the one light theme: it scopes `color-scheme: light` to its class so native controls
  (select popups, date pickers) match; everything else relies on the dark default in `globals.css`.
- Check a theme change visually on several themes with the `ui-sandbox` skill (`/appearance` shows them all).
