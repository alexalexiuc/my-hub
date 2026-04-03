# Hub Package — Agent Guidelines

## Component Location

- **`src/components/`** — global, reusable atom/molecule components only (e.g. `SectionCard`, `PageHeader`, `Button`, `Field`, `IconButton`). Must be completely page-agnostic.
- **`src/components/icons/`** — SVG icon components (e.g. `PencilIcon`, `TrashIcon`). Must be completely page-agnostic.
- **`src/app/<page>/`** — page-specific section components live **co-located with their page**. Never add page-specific logic to `src/components/`.

## Page Size Rule

**Pages must not exceed ~300 lines.** When a page grows beyond this, split it into co-located section components in the same directory.

Each section component should:

- **Own its own local UI state** (form inputs, edit mode toggles)
- **Receive a minimal prop surface**: relevant data slice, `canEdit` flag, and `onChanged()` refresh callback
- **Make its own API calls** — do not hoist fetch logic into the page to pass it down
- **Shared micro-components** used across sections within the same page → `ui.tsx` in that page's directory
- **Shared TypeScript interfaces** needed by multiple section files → `types.ts` in that page's directory

### Example

```tsx
// src/app/travel/ChecklistSection.tsx
interface ChecklistSectionProps {
  activeTripId: number | null;
  canEdit: boolean;
  checklist: TripChecklistItem[];
  onChanged: () => void;
}
```

## Naming Conventions

- **Component files**: PascalCase matching the exported component name (e.g. `BookingsSection.tsx`, `TripsSidebar.tsx`).
- **Icon components**: PascalCase with `Icon` suffix (e.g. `PencilIcon.tsx`, `TrashIcon.tsx`).
- **Shared page helpers**: lowercase `ui.tsx` and `types.ts` in that page's directory.
- **Use named exports** for all components — never default exports.

## Components

- **Global components** (e.g. `SectionCard`, `PageHeader`, `Button`, `Field`, `IconButton`) → `src/components/`
- **Icon components** (e.g. `PencilIcon`, `TrashIcon`) → `src/components/icons/`
- **Dashboard widgets** (e.g. `CaloriesWidget`, `TodoWidget`) → `src/components/dashboard/`
- **Page-specific section components** → co-located in `src/app/<page>/`
- **Shared micro-components** used across sections within the same page → `ui.tsx` in that page's directory
- **Shared TypeScript interfaces** needed by multiple section files → `types.ts` in that page's directory

## Barrel Exports

Each grouping under `src/components/` has a barrel `index.ts`:

- `src/components/index.ts` — re-exports all global components
- `src/components/icons/index.ts` — re-exports all icon components
- `src/components/dashboard/index.ts` — re-exports all dashboard widgets

When adding a new component, also add it to the relevant barrel file.

## Reference Implementations

- `src/app/travel/` — 7 section components + `types.ts`
- `src/app/calories/` — section components co-located with page
- `src/app/profile/NotificationsSection.tsx` — pattern for rendering grouped notification checkboxes from `NOTIFICATION_SUBSCRIPTIONS` config; fetches and persists subscription state via `/api/user/notification-preferences`
