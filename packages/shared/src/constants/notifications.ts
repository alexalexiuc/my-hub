/**
 * Single source of truth for all notification subscription types.
 * Lives in constants (not services) so it can be safely imported by
 * Next.js client components without pulling in any Node.js-only code.
 *
 * Keys are stored as plain text in the DB — never use PG enums for subscription keys.
 * The UI uses this array to dynamically render sections and checkboxes.
 */
export const NOTIFICATION_SUBSCRIPTIONS = [
  { key: 'calories_weekly_report', label: 'Weekly Report', section: 'Calories' },
  { key: 'calories_monthly_report', label: 'Monthly Report', section: 'Calories' },
] as const;

export type SubscriptionKey = (typeof NOTIFICATION_SUBSCRIPTIONS)[number]['key'];
