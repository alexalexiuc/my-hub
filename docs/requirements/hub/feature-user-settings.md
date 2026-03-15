# Feature: User Profile & Settings

| Field    | Value                          |
| -------- | ------------------------------ |
| Status   | implemented                    |
| Priority | medium                         |
| File     | `hub/feature-user-settings.md` |

---

## Summary

The Profile page (`/profile`) lets the authenticated user view their account details,
update their display name, sign out, and permanently delete their data on a per-feature
basis. Auth is handled by NextAuth.js with Google OAuth; there is no password management.

---

## Functional Requirements

| ID    | Requirement                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The profile page must display the user's email address and the date their account was created.                                      |
| FR-02 | The user must be able to update their display name; the change is persisted to the `users` table and reflected immediately on save. |
| FR-03 | The user must be able to select one or more data features and permanently delete all their data for those features.                 |
| FR-04 | Data deletion must require a two-step confirmation: the user selects features, then explicitly confirms before deletion executes.   |
| FR-05 | After deletion, the page must display a summary of what was removed (record counts per feature).                                    |
| FR-06 | The user must be able to sign out from the profile page; signing out ends the NextAuth session.                                     |
| FR-07 | Accessing the profile page while unauthenticated must redirect to the sign-in page.                                                 |

---

## Data features eligible for deletion

| Feature key        | Data deleted                                 |
| ------------------ | -------------------------------------------- |
| `meals`            | All rows in `meal_logs` for the user         |
| `measurements`     | All rows in `body_measurements` for the user |
| `calories_profile` | The row in `calorie_profiles` for the user   |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | The profile page lives at `packages/hub/src/app/profile/page.tsx` and is a client component (`"use client"`).                                                              |
| TR-02 | Account info and name updates are served by `GET /api/user/profile` and `PUT /api/user/profile` respectively.                                                              |
| TR-03 | Data deletion is handled by `POST /api/user/delete-data` with body `{ features: string[] }`. Only keys from the allowed list are accepted.                                 |
| TR-04 | All API routes call `getAuthUser()` (resolves the DB user from the NextAuth session email) and return 401 if unauthenticated.                                              |
| TR-05 | Name updates call `updateUserName(userId, name)` from `@my-hub/shared/services`; deletions call `deleteAllUserMeals`, `deleteAllUserMeasurements`, `deleteCalorieProfile`. |
| TR-06 | Authentication uses NextAuth.js with the Google provider; there is no username/password login. Password management (original FR-01) is not applicable.                     |
| TR-07 | The page uses shared components from `packages/hub/src/components/`: `PageHeader`, `SectionCard`, `Field`, `Button`.                                                       |

---

## Open Questions

- [ ] Should there be a "delete account" option that also removes the `users` row and revokes all OAuth clients?
- [ ] Should the platform support multiple user accounts? Currently single-user (small invite group) — no per-user isolation beyond `user_id` FK.
- [ ] Should preference settings (timezone, default calorie goal) be added here in a future iteration?

---

## Acceptance Criteria

- [x] The profile page displays the signed-in user's email and member-since date.
- [x] The user can update their display name and the change persists across page reloads.
- [x] Selecting `meals` and confirming deletion removes all meal log rows for the user.
- [x] Selecting `measurements` and confirming deletion removes all body measurement rows for the user.
- [x] Selecting `calories_profile` and confirming deletion removes the calorie profile row for the user.
- [x] Deletion requires two steps (select + confirm); no data is deleted before the confirm button is clicked.
- [x] Clicking "Sign out" ends the session and redirects to the sign-in page.
- [x] Visiting `/profile` without a session redirects to `/auth/signin`.
