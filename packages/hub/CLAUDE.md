# hub package — Agent Guidelines

Before writing a helper, run `pnpm inventory packages/shared/src/utils` (general-purpose helpers belong there) and
`pnpm inventory packages/hub/src/components` (reuse before you build).

## Where things go

- `src/components/` — page-agnostic atoms/molecules only (`Button`, `Card`, `SectionCard`, `Field`, …), barrel
  `index.ts`. `icons/` (barrel too) for SVG icons, `dashboard/` for dashboard layout only.
- `src/app/<page>/` — page sections, its dashboard widget (re-exported from `src/components/widgets/index.ts`),
  `ui.tsx` (micro-components shared by sections), `types.ts`, `<feature>.utils.ts` (+ `.test.ts`).
- `src/hooks/` — hooks reused across features (`@/hooks/<name>`); feature-only hooks stay with the feature.
- API routes: `src/app/api/<domain>/…/route.ts` using `route({ query | body })`; shared query schemas in
  `@/lib/schemas/common` (`isoDateSchema`, `isoMonthSchema`).
- Reference implementations: `src/app/travel/`, `src/app/calories/`, `src/app/profile/NotificationsSection.tsx`.

## Component rules

- One component per file, PascalCase file = export name, named exports only, props `type <Name>Props` in the
  same file. Up to 2–3 small co-located helpers if not independently useful; utility functions go in a separate
  `.utils.ts`.
- A new top-level `src/components/*.tsx` ships with a story (`src/components/stories/<Name>.stories.tsx`,
  `@storybook/nextjs-vite`, pattern: `Select.stories.tsx`) and a vitest + jsdom test (`<Name>.test.tsx`) in the
  same change, and is added to the barrel.
- File-level JSDoc inventory headers only in `src/components/` (not in `src/app/…`).
- Pages stay under ~300 lines: split into section components that own their UI state, take a minimal prop surface
  (`data`, `canEdit`, `onChanged()`), and make their own API calls.
- Responsive duplicates (`hidden md:block` / `md:hidden`): put `data-layout="desktop|mobile"` on the element that
  carries the responsive class, so tests can target one.

## Data fetching

Always `apiFetch` from `@/lib/utils`, never global `fetch`:

```ts
const { trips } = await apiFetch<{ trips: Trip[] }>('/api/travel/trips', { query: { limit: 20, type: undefined } }); // nullish query values dropped
await apiFetch('/api/travel/trips', { method: 'POST', body: { name } }); // JSON-encoded; FormData passed through
```

Throws `ApiError` (`.status`) on non-2xx; empty responses return `undefined`. It toasts globally: errors always,
"Saved/Deleted successfully" for POST/PUT/PATCH/DELETE, nothing for GET; `silentToast: true` opts out. Add a local
`try/catch` only for status-specific UI (e.g. a 401 state).

## Styling and colour

- Tailwind `className` only; inline `style` only for runtime values (user hex, CSS var, `calc()`). Join classes
  with `cn()` from `@/lib/utils`.
- Colour comes from theme tokens: `bg-[var(--card)]`, `text-[var(--muted)]`, `--accent`, semantic `--green`/`--red`/…
  **Never** a literal Tailwind colour (`bg-emerald-600`) inside themed UI, and **never `text-white` on
  `--accent`** — use `text-[var(--on-accent)]`.
- Shared components may render outside a theme: give tokens a fallback (`bg-[var(--card,#18181b)]`).
- Prefer `Button`, `IconButton`, `Card`, `SectionCard` over hand-styled elements. Feature subtrees are wrapped in
  `<FeatureTheme feature="…">`. Anything deeper (token table, palettes generator, contrast, signatures) → the
  `hub-theming` skill.
- Form controls from `@/components`, not bare elements: `Input` (`variant="ghost"` for inline fields), `Select`
  (`options` prop; placeholder as children), `Textarea`, `ColorPicker`, `Checkbox`, `FilePicker`, `DatePicker`.
  In flex filter rows override width with `className="w-auto"`.

## Env

Lazy `get` getters are mandatory here: `next build` loads route modules, so an eager `process.env` read fails the
Docker build. Every new required var also needs a placeholder `ENV` line in `packages/hub/Dockerfile` (after the
shared build step).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
