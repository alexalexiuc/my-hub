# Feature: Data Explorer

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Status   | draft                                  |
| Priority | medium                                 |
| File     | `hub/feature-data-explorer.md`         |

---

## Summary

The Data Explorer section of the Hub admin panel provides direct visibility into and
control over the data stored in PostgreSQL. The initial version offers raw table views
with basic CRUD operations across all domain tables (hive logs, meals, profiles, todos,
inventory, etc.). Later iterations will add domain-specific visualisations such as an
apiary inspection timeline and calorie charts.

---

## Functional Requirements

### Phase 1 — Raw Table Views

| ID    | Requirement |
| ----- | ----------- |
| FR-01 | The admin must be able to browse any domain table (hive inspections, meals, profiles, hive todos, product inventory, shopping list, product catalog) in a paginated table view. |
| FR-02 | Each row must be editable inline or via a detail drawer/modal. |
| FR-03 | The admin must be able to delete a row, with a confirmation prompt before deletion. |
| FR-04 | The admin must be able to create a new record in any table via a form. |
| FR-05 | Tables must support sorting by any column and basic text filtering/search. |

### Phase 2 — Domain-Specific Views (future)

| ID    | Requirement |
| ----- | ----------- |
| FR-06 | An apiary timeline view showing hive inspection history grouped by hive, with observations and actions displayed chronologically. |
| FR-07 | A calorie chart view showing daily calorie intake over a selectable date range, with macro breakdown. |

---

## Technical Requirements

| ID    | Requirement |
| ----- | ----------- |
| TR-01 | The Data Explorer lives entirely in `packages/admin`. Data is fetched via Next.js Server Actions or API routes that query PostgreSQL through Drizzle. |
| TR-02 | No raw SQL strings are accepted from the browser — all queries are parameterised Drizzle calls to prevent injection. |
| TR-03 | Only authenticated admin users can access the Data Explorer. |
| TR-04 | Pagination must be server-side; the browser never receives the full table contents in a single response. |
| TR-05 | Delete operations must use a soft-delete pattern or a confirmation gate to reduce risk of accidental data loss. |
| TR-06 | Phase 2 chart views should use a lightweight charting library (e.g. Recharts) already compatible with the Next.js App Router. |

---

## Open Questions

- [ ] Should edit/delete actions be available to all admin users or only to a super-admin role?
- [ ] Is an audit log of data changes (who changed what, when) required from the start?
- [ ] For Phase 2, should calorie charts support date range selection, or only a fixed window (last 7 / 30 days)?
- [ ] Should the Data Explorer support CSV export of table data?

---

## Acceptance Criteria

- [ ] All domain tables are browsable with pagination and sorting.
- [ ] An admin can edit a meal record and see the updated value reflected immediately.
- [ ] An admin can create a new hive inspection record via the form.
- [ ] Deleting a record requires a confirmation step and the record is no longer visible after deletion.
- [ ] Accessing the Data Explorer while unauthenticated redirects to the login page.
- [ ] (Phase 2) The calorie chart correctly reflects the logged meals for the selected date range.
