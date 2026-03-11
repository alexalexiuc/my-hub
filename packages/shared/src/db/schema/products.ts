import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Products / Home Inventory tables
// ---------------------------------------------------------------------------

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  barcode: text("barcode").unique(),
  category: text("category"),
  unit: text("unit"), // kg | l | pcs | …
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 10, scale: 3 })
    .notNull()
    .default("0"),
  location: text("location"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const shoppingListItems = pgTable("shopping_list_items", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(), // denormalised in case productId is null
  quantity: numeric("quantity", { precision: 10, scale: 3 }),
  unit: text("unit"),
  checked: boolean("checked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
