# hub package — Agent Guidelines

@import ../../shared/CLAUDE.md

## Component location

- **`src/components/`** — global, reusable atom/molecule components only (e.g. `SectionCard`, `PageHeader`, `Button`, `Field`, `IconButton`). Must be completely page-agnostic.
- **`src/components/icons/`** — SVG icon components (e.g. `PencilIcon`, `TrashIcon`). Must be completely page-agnostic.
- **`src/components/dashboard/`** — dashboard-level layout only (e.g. `DashboardHeader`, `DashboardFooter`). Do **not** put feature widgets here.
- **`src/components/widgets/`** — barrel re-exports for dashboard widgets; the widget implementations live co-located with their feature (see below).
- **`src/app/<page>/`** — page-specific section components and their dashboard widget live **co-located with their page**. When a widget shares significant logic or subcomponents with its feature page, implement it here and re-export from `src/components/widgets/index.ts`. Never add page-specific logic to `src/components/`.
  - Example: `src/app/calories/CaloriesWidget.tsx` and `src/app/calories/CaloriesDonut.tsx` are co-located with the calories feature and re-exported via `src/components/widgets/index.ts`.

## Component rules

- One component per file. Small co-located helpers allowed (max 2–3) only if not independently useful.
- Props typed in the same file as a `type` named `[ComponentName]Props`.
- Reusable components go to `src/components/` — never duplicate inline.
- Named exports only, no default exports for components.

## Component coverage requirements

Every new component added to `src/components/` (top-level `.tsx` files only, not subdirectories) **must** be accompanied by:

1. **Storybook story** at `src/components/stories/ComponentName.stories.tsx` — use `@storybook/nextjs-vite`, follow the pattern in existing story files (see `Select.stories.tsx` for a reference).
2. **Unit test** at `src/components/ComponentName.test.tsx` — use vitest + jsdom, test the component's rendered output and key interactions.

Create both files in the same task as the component. Do not defer them.

## Responsive layout duplicates

When a component renders two variants of the same content (one for desktop, one for mobile) using Tailwind's responsive visibility classes (`hidden md:block`, `md:hidden`, etc.), add a `data-layout` attribute to the outermost element of each variant so that tests and tooling can unambiguously target one layout:

```tsx
{
  /* Desktop */
}
<div data-layout="desktop" className="hidden md:grid ...">
  ...
</div>;

{
  /* Mobile */
}
<div data-layout="mobile" className="... md:hidden">
  ...
</div>;
```

Apply `data-layout` at the element that carries the `hidden`/responsive class, not deeper inside it.

## Page size rule

**Pages must not exceed ~300 lines.** When a page grows beyond this, split it into co-located section components in the same directory.

Each section component should:

- **Own its own local UI state** (form inputs, edit mode toggles)
- **Receive a minimal prop surface**: relevant data slice, `canEdit` flag, and `onChanged()` refresh callback
- **Make its own API calls** — do not hoist fetch logic into the page to pass it down
- **Shared micro-components** used across sections within the same page → `ui.tsx` in that page's directory
- **Shared TypeScript interfaces** needed by multiple section files → `types.ts` in that page's directory

## Naming conventions

- **Component files**: PascalCase matching the exported component name (e.g. `BookingsSection.tsx`, `TripsSidebar.tsx`).
- **Icon components**: PascalCase with `Icon` suffix (e.g. `PencilIcon.tsx`, `TrashIcon.tsx`).
- **Shared page helpers**: lowercase `ui.tsx` and `types.ts` in that page's directory.
- **Feature-scoped utility files**: `[feature].utils.ts` in the same folder (e.g. `coming-next.utils.ts`).

## Utility rules

- Util functions live in a separate file, never inline in a component file.
- If specific to one feature and not reusable → `[feature].utils.ts` in the same folder.
- If general purpose → it goes in `packages/shared/src/utils/`. Check the shared CLAUDE.md first.

## React hooks

- **`src/hooks/`** — reusable React hooks used across multiple features (e.g. `useDebounce`, `useUserNameFromSession`). Import via `@/hooks/<name>`.
- Feature-scoped hooks that are not independently reusable belong co-located with their feature file, not in `src/hooks/`.

## API fetch rule

**Always use `apiFetch` from `@/lib/utils` — never call the global `fetch` directly in hub client code.**

```ts
import { apiFetch, ApiError } from '@/lib/utils';

// GET with typed response
const data = await apiFetch<{ todos: Todo[] }>('/api/todo');

// GET with query params (null/undefined values are omitted automatically)
const data = await apiFetch<{ meals: Meal[] }>('/api/calories/meals', {
  query: { date: today, limit: 100, type: undefined }, // type omitted
});

// POST/PATCH — body auto-JSON-stringified, Content-Type set automatically
await apiFetch('/api/todo', { method: 'POST', body: { title } });

// DELETE — no body needed
await apiFetch(`/api/todo/${id}`, { method: 'DELETE' });

// FormData — no Content-Type injected (browser sets multipart boundary)
await apiFetch('/api/upload', { method: 'POST', body: formData });

// Optional: local status-specific handling (global toasts still apply)
try {
  await apiFetch('/api/user/profile', { method: 'PUT', body: profilePayload });
} catch (e) {
  if (e instanceof ApiError && e.status === 401) {
    setError('Not signed in');
    return;
  }
  throw e;
}
```

`apiFetch` throws `ApiError` (with `.status`) on non-2xx. Empty responses (204 / no body) return `undefined`.

By default, `apiFetch` now shows global toasts:

- Error toast for non-2xx responses.
- Success toast for `POST`/`PUT`/`PATCH` (`Saved successfully`) and `DELETE` (`Deleted successfully`).
- `GET` remains silent by default.
- Use `silentToast: true` to suppress toasts for a specific request.

Only add a local `try/catch` when the component needs status-specific behavior (for example, custom `401` UI state).

## Styling rules

- **Always prefer `className` with Tailwind utility classes** for all visual styling. Do not use inline `style` props unless Tailwind cannot express the value — for example, a dynamic colour derived at runtime (`style={{ color: userPickedHex }}`), a CSS custom property, or a `calc()` expression that requires a runtime value.
- Use `cn` from `@/lib/utils` (wraps `clsx` + `twMerge`) for joining Tailwind class names:

```ts
import { cn } from '@/lib/utils';
cn('base-class', condition && 'conditional-class', className);
```

## Input components

Use these components from `@/components` instead of bare HTML elements:

| Component     | Replaces                  | Notes                                                                                                             |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Input`       | `<input>`                 | Applies `.input` CSS class; supports `variant="ghost"` for transparent border-bottom style (todo rows)            |
| `Select`      | `<select>`                | Applies `.input`; accepts `options` prop for data-driven option lists; blank/placeholder options go as `children` |
| `Textarea`    | `<textarea>`              | Applies `.input`                                                                                                  |
| `ColorPicker` | `<input type="color">`    | Circular swatch, `h-8 w-8`                                                                                        |
| `Checkbox`    | `<input type="checkbox">` | `accent-blue-500`; override accent color via `className`                                                          |
| `FilePicker`  | `<input type="file">`     | Separate component — will gain drag-and-drop in future                                                            |

```tsx
import { Input, Select, Textarea, ColorPicker, Checkbox, FilePicker } from '@/components';

<Input type="number" value={val} onChange={...} />
<Input variant="ghost" placeholder="New task..." ref={inputRef} />
<Select value={val} onChange={...} options={DATA_OPTIONS}><option value="">Pick one</option></Select>
<Textarea rows={3} className="resize-none" value={val} onChange={...} />
<ColorPicker value={color} onChange={(e) => setColor(e.target.value)} />
<Checkbox checked={val} onChange={(e) => toggle(e.target.checked)} />
<FilePicker accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
```

For filter controls in flex rows that must not be `w-full`, override with `className="w-auto"`.

## Barrel exports

Each grouping under `src/components/` has a barrel `index.ts`:

- `src/components/index.ts` — re-exports all global components
- `src/components/icons/index.ts` — re-exports all icon components
- `src/components/dashboard/index.ts` — re-exports all dashboard widgets

When adding a new component, also add it to the relevant barrel file.

## JSDoc inventory comments

File-level JSDoc inventory comments (listing exports with one-liners) are written **only** in:

- `packages/shared/src/utils/` and `packages/shared/src/services/`
- `packages/hub/src/components/`

Do **not** add them to feature folders (`src/app/…`).

## Reference implementations

- `src/app/travel/` — section components + `types.ts` + `coming-next.utils.ts`
- `src/app/calories/` — section components co-located with page
- `src/app/profile/NotificationsSection.tsx` — pattern for rendering grouped notification checkboxes from `NOTIFICATION_SUBSCRIPTIONS` config; fetches and persists subscription state via `/api/user/notification-preferences`

## Hub E2E notes

- Hub UI Playwright fixtures live in `packages/e2e`, not in `packages/hub` or `packages/mcp-server`.
- CI seeds Hub E2E data by executing the compiled `packages/e2e/scripts/setup-e2e-db.ts` bundle inside the `hub` container.
- Local Hub E2E runs seed via `packages/e2e/global.setup.ts` only when `IS_LOCAL=true`; keep that flow process-based rather than directly importing the seed module into Playwright setup.

## Travel booking display: two separate paths

There are two independent rendering paths for bookings. When changing how a booking type is displayed, **both need updating**:

| File                                  | What it drives                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/travel/coming-next.utils.ts` | "Coming Next" timeline — `primaryLabel`, `secondaryLabel`, endpoint labels, navigate URLs |
| `src/app/travel/BookingsSection.tsx`  | Reservations list + add/edit form UI                                                      |

## API field naming: `flightDetails` → `details` column

The booking POST/PATCH API accepts `body.flightDetails` and stores it directly as the `details` JSONB column. The name is historical — it is used for all detail types (`FlightDetails`, `TransportDetails`, etc.), not just flights.

When adding support for a new details shape in the UI, pass it as `body.flightDetails` in the fetch call.
