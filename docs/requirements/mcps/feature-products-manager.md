# Feature: Products Manager MCP

| Field    | Value                              |
| -------- | ---------------------------------- |
| Status   | draft                              |
| Priority | medium                             |
| File     | `mcps/feature-products-manager.md` |

---

## Summary

The Products Manager MCP server provides AI-assisted home inventory and shopping list
management. It lets an AI client (Claude) check what is in stock at home, update
quantities after shopping, flag low-stock items, and manage a running shopping list —
all against a product catalog that the user curates over time.

---

## Functional Requirements

### Inventory

| ID    | Requirement                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The server must expose a tool (`products_inventory_get`) to list all items currently at home, with optional filters for category and storage location (fridge / pantry / freezer). |
| FR-02 | The server must expose a tool (`products_inventory_update`) to add or update the quantity of a product in stock (e.g. "I bought 2 bottles of olive oil").                          |
| FR-03 | The server must expose a tool (`products_inventory_consume`) to reduce a product's stock quantity (e.g. "used the last of the pasta").                                             |
| FR-04 | The server must expose a tool (`products_inventory_get_low_stock`) to list all items whose current quantity is below their configured minimum stock level.                         |

### Shopping List

| ID    | Requirement                                                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-05 | The server must expose a tool (`products_shopping_list_get`) to retrieve the current shopping list.                                                        |
| FR-06 | The server must expose a tool (`products_shopping_list_add`) to add a product and desired quantity to the shopping list.                                   |
| FR-07 | The server must expose a tool (`products_shopping_list_mark_bought`) to mark an item as bought; optionally this should also update the inventory quantity. |
| FR-08 | The server must expose a tool (`products_shopping_list_clear`) to remove all items with status `bought` from the list.                                     |
| FR-09 | The server must expose a tool (`products_shopping_suggest`) that generates a suggested shopping list based on low-stock items and existing list contents.  |

### Product Catalog

| ID    | Requirement                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-10 | The server must expose a tool (`products_catalog_add`) to add a new product to the catalog (name, category, unit, preferred brand, usual store, default buy quantity, minimum stock level). |
| FR-11 | The server must expose a tool (`products_catalog_get`) to look up a single product's details by ID or name.                                                                                 |
| FR-12 | The server must expose a tool (`products_catalog_list`) to list all known products, with optional category filter.                                                                          |
| FR-13 | The server must expose a tool (`products_catalog_update`) to update a product's metadata (min stock, preferred brand, etc.).                                                                |
| FR-14 | All tools must be scoped to the authenticated user.                                                                                                                                         |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Implementation lives in `packages/mcp-server` as a self-contained module (e.g. `src/servers/products/`).                                                                          |
| TR-02 | The DB schema must be defined in `packages/shared/src/db/schema` using Drizzle ORM with the following tables: `products_catalog`, `products_inventory`, `products_shopping_list`. |
| TR-03 | `products_catalog` columns: `id`, `name`, `category`, `unit`, `preferred_brand`, `usual_store`, `min_stock_qty`, `default_buy_qty`, `notes`.                                      |
| TR-04 | `products_inventory` columns: `id`, `product_id` (FK → catalog), `quantity`, `location`, `expiry_date`, `updated_at`.                                                             |
| TR-05 | `products_shopping_list` columns: `id`, `product_id` (FK → catalog), `quantity`, `priority`, `notes`, `status` (`pending` / `bought`), `added_at`, `bought_at`.                   |
| TR-06 | Access is protected by OAuth 2.0 using the shared middleware.                                                                                                                     |
| TR-07 | The server must be reachable at the `/mcp/products/:userId` route of the shared MCP Fastify app.                                                                                  |
| TR-08 | MCP transport must support both SSE and Streamable HTTP as offered by the MCP SDK.                                                                                                |

---

## Open Questions

- [ ] Should `products_shopping_list_mark_bought` automatically update inventory, or should that be a separate explicit call? What is the preferred AI interaction flow?
- [ ] Should the catalog be shared across users (global product database) or private per user?
- [ ] Is barcode scanning (mobile) in scope for the first iteration, or strictly a future enhancement?
- [ ] How should expiry dates be handled — alert when an item is near expiry?

---

## Acceptance Criteria

- [ ] A Claude client can ask "what do I need to buy?" and receive a combined view of low-stock items and current shopping list.
- [ ] After a shopping trip described in natural language (e.g. "I bought X, Y, Z"), the shopping list items are marked bought and inventory is updated.
- [ ] A product with quantity below `min_stock_qty` appears in `products_inventory_get_low_stock`.
- [ ] `products_shopping_suggest` returns at least all low-stock items not already on the shopping list.
- [ ] An unauthenticated request to any products tool returns a 401 error.
- [ ] Unit tests cover core tool handlers for inventory, shopping list, and catalog operations.
