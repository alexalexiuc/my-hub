import { pgTable, serial, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import type { ThemeScope, ThemeKey } from '../../constants/themes';

/**
 * Stores per-user, per-scope color theme preferences.
 * Absence of a row for a scope means "inherit from the next scope up" —
 * see `resolveUserThemes` in `src/services/user-theme-preferences/` for the resolution order.
 */
export const userThemePreferences = pgTable(
  'user_theme_preferences',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').$type<ThemeScope>().notNull(),
    themeKey: text('theme_key').$type<ThemeKey>().notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => [uniqueIndex('user_theme_scope_idx').on(table.userId, table.scope)],
);
