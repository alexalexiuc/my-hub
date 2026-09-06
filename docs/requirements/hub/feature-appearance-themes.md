# Feature: Appearance & Colour Themes

| Field    | Value                              |
| -------- | ---------------------------------- |
| Status   | in-progress                        |
| Priority | medium                             |
| File     | `hub/feature-appearance-themes.md` |

---

## Summary

The Hub ships a library of dark colour themes that the user picks from on the Profile page. One
choice applies to the whole app; each themed feature (Travel, Finances, Calories) can optionally
override it. Themes are chosen on two axes — an accent **hue** and a **mood** controlling how
deeply that hue tints the surfaces — plus four hand-preserved **signature** presets that reproduce
the palettes the app shipped with. Until the user picks something, every surface looks exactly as
it did before.

---

## Theme model

| Concept       | Values                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Hue (12)      | Emerald, Lime, Amber, Orange, Rose, Fuchsia, Violet, Indigo, Ocean, Sky, Teal, Slate               |
| Mood (3)      | `soft` (pastel accent, near-neutral surfaces), `classic`, `deep` (saturated accent, rich surfaces) |
| Signature (4) | `graphite-signature`, `travel-signature`, `finances-signature`, `calories-signature`               |
| Scope (4)     | `global`, `travel`, `finances`, `calories`                                                         |

A theme key is either a signature key or `<hue>-<mood>` — 40 in total.

---

## Functional Requirements

| ID    | Requirement                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The user must be able to choose a colour theme that applies to the entire app, from the Profile page.                                 |
| FR-02 | The user must be able to override the theme independently for Travel, Finances and Calories.                                          |
| FR-03 | A feature with no override must follow the global choice; clearing an override must restore that inheritance.                         |
| FR-04 | With nothing chosen, each feature must render its original palette and the rest of the app the Graphite (zinc) palette.               |
| FR-05 | Selecting a theme must repaint the page immediately, before the change is persisted.                                                  |
| FR-06 | The chosen theme must persist across reloads and sessions, and must be applied on the first server render without flash.              |
| FR-07 | Every preset must keep body and secondary text legible, and must keep success/warning/danger colours distinguishable from the accent. |
| FR-08 | Deleting all user data must remove the user's stored theme preferences.                                                               |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Theme identity (hues, moods, signatures, scopes, keys, `themeClassName`) lives in `packages/shared/src/constants/themes.ts` so client components can import it.                                                                                      |
| TR-02 | Preferences are stored in `user_theme_preferences` (`user_id`, `scope`, `theme_key`), unique on `(user_id, scope)`. Absence of a row means "inherit". The DB stores keys only — never colour values.                                                 |
| TR-03 | Resolution order for a feature scope is: its own row -> the global row -> that feature's own signature default. `resolveUserThemes` / `resolveThemeMap` in `packages/shared/src/services/user-theme-preferences/` own this rule.                     |
| TR-04 | The 36 generated palettes are produced by `packages/hub/scripts/gen-palettes.mts` (OKLCH via `culori`, build-time only) into `src/styles/themes.generated.css` and `src/lib/theme-swatches.generated.ts`, both committed.                            |
| TR-05 | The generator asserts WCAG contrast on every palette and throws on failure. CI runs `gen:palettes:check`, which regenerates and fails on drift — re-running those assertions in the process.                                                         |
| TR-06 | Every theme CSS class ends in `-theme`, because `usePortalTheme` matches `/\b\S+-theme\b/` to re-apply a palette onto portaled modals.                                                                                                               |
| TR-07 | `packages/hub/src/app/layout.tsx` resolves the user's overrides server-side and renders the global theme class on `<body>`, so the first paint is correct.                                                                                           |
| TR-08 | `ThemeProvider` holds the raw overrides (not the resolved map) and re-derives resolution, so a global change flows through to features that never set an override. `FeatureTheme` applies the resolved class plus a stable `data-feature` attribute. |
| TR-09 | `GET`/`PUT /api/user/theme-preferences`; `PUT` takes `{ scope, themeKey }` where `themeKey: null` clears the override.                                                                                                                               |
| TR-10 | The picker is `packages/hub/src/components/ThemePicker.tsx`, mounted via `packages/hub/src/app/profile/AppearanceSection.tsx`.                                                                                                                       |
| TR-11 | `deleteAllUserThemePreferences` is called from `packages/hub/src/app/api/user/delete-all/route.ts`.                                                                                                                                                  |

---

## Palette design notes

- All three original palettes already shared one surface **lightness ladder**; it is mood-invariant
  in the generator, and mood varies chroma only. That ladder is what makes the contrast assertions
  hold uniformly.
- Accents sit at a fixed fraction of the sRGB gamut boundary for their hue, which normalises
  vividness across hues whose available chroma differs by up to 2.6x.
- Surfaces in the amber/orange band are pulled toward ember rather than olive. The muddiness of the
  original Calories palette was its surfaces sitting 19–33° off its own accent hue, not
  over-saturation — its surfaces actually carried _less_ chroma than Travel's.
- The 16 semantic tokens are frozen across all 36 palettes so `--red` always means danger. The one
  exception: a semantic token within 25° of hue and 0.08 of lightness of the accent is promoted to
  its lighter variant, so a Rose accent still has an unambiguous red.
- `--border` is deliberately exempt from the 3:1 rule (a floor of 1.35:1 is asserted instead): the
  design uses hairline dividers, and the controls themselves carry `--accent`.

---

## Open Questions

- [ ] Should a light mode be offered? Every palette is currently dark-only, matching the app.
- [ ] Should `/apiary` be converted to tokens? It is deliberately out of scope and still uses
      hardcoded zinc.
- [ ] Should the per-trip and finance-category colour palettes (data colours, not theme colours)
      be re-derived from the active theme?

---

## Acceptance Criteria

- [x] A global theme can be chosen and applies across the shell and all three features.
- [x] Each feature can override the global theme, and the override can be cleared.
- [x] Defaults reproduce the original palettes; nothing changes visually until a theme is picked.
- [x] Selecting a theme repaints immediately.
- [x] The first server render carries the right palette (no flash).
- [x] All 40 presets pass the contrast assertions, enforced in CI.
- [x] Theme preferences are removed by the delete-all route.
- [ ] Verified end to end against a live Hub instance with the Playwright suite.
