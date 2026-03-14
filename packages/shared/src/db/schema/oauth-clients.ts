import { pgTable, serial, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const oauthClients = pgTable("oauth_clients", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  // Client sends this to /token for authentication
  clientSecret: text("client_secret").notNull(),
  // Server-only secret used to HMAC-sign auth codes and access tokens (never sent to client)
  tokenSigningSecret: text("token_signing_secret").notNull(),
  // null until the user completes /authorize
  userId: uuid("user_id").references(() => users.id),
  clientName: text("client_name"),
  redirectUris: text("redirect_uris").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
