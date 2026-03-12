# Feature: User & Settings

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Status   | draft                                  |
| Priority | low                                    |
| File     | `hub/feature-user-settings.md`         |

---

## Summary

The User & Settings section of the Hub admin panel lets the owner manage their account
credentials, application-level preferences, and any API keys used by the platform.
Given the current single-user (or small invite group) scope, this is a simple personal
settings page rather than a full multi-user account management system.

---

## Functional Requirements

| ID    | Requirement |
| ----- | ----------- |
| FR-01 | The admin must be able to change their login password from the settings page. |
| FR-02 | The admin must be able to view and regenerate any platform-level API keys (e.g. keys used by integrations). Regeneration invalidates the old key immediately. |
| FR-03 | The admin must be able to update application preferences (e.g. timezone, default daily calorie goal, display language if applicable). |
| FR-04 | The settings page must display the currently logged-in user's identity (username / email) and session information. |
| FR-05 | The admin must be able to log out, which invalidates the current session server-side. |

---

## Technical Requirements

| ID    | Requirement |
| ----- | ----------- |
| TR-01 | Authentication for the admin panel uses NextAuth.js (credentials provider) or a custom JWT session; the approach must be consistent across all Hub pages. |
| TR-02 | Passwords are stored as bcrypt hashes; plaintext passwords are never logged or persisted. |
| TR-03 | Session invalidation on logout must be server-side (token blacklist or database session table) so that stolen tokens cannot be replayed after logout. |
| TR-04 | API keys are stored as bcrypt hashes; the plaintext is shown only once at generation time. |
| TR-05 | The settings page lives in `packages/admin` and all write operations go through Next.js Server Actions or API routes. |
| TR-06 | If GitHub/Google OAuth login is used instead of username/password, the password-change requirement (FR-01) is replaced by a "connected accounts" view. |

---

## Open Questions

- [ ] Should the platform support multiple user accounts (small invite group), or remain strictly single-user? This affects the complexity of the settings page significantly.
- [ ] Username/password login vs GitHub/Google OAuth — which is preferred for the initial version?
- [ ] Should there be a notifications/alerts preferences section (e.g. email reminders for hive inspections, low stock)?

---

## Acceptance Criteria

- [ ] The admin can change their password and log in successfully with the new password; the old password is rejected.
- [ ] Logging out invalidates the session; navigating back to any protected page redirects to login.
- [ ] Regenerating an API key causes the old key to be rejected by any service that checks it.
- [ ] Preference changes (e.g. timezone) are persisted and reflected on the next page load.
- [ ] Accessing the settings page while unauthenticated redirects to the login page.
