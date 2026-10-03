import type { SidebarNavItem } from '@/components';

/**
 * The vacation planner's tabs, shared by the desktop sidebar and the mobile bottom nav so the two
 * can never list different destinations. Calendar is the root route, hence `exact`.
 */
export const VACATION_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'calendar', label: 'Calendar', icon: '📅', path: '/vacation', exact: true },
  { id: 'leave', label: 'Vacations', icon: '🏖', path: '/vacation/leave' },
  { id: 'payments', label: 'Payments', icon: '💰', path: '/vacation/payments' },
  { id: 'profile', label: 'Profile', icon: '⚙', path: '/vacation/profile' },
];

export const LEAVE_STATUS_LABELS = { taken: 'Taken', planned: 'Planned' } as const;

export const SALARY_KIND_LABELS = { actual: 'Actual', projected: 'Projected' } as const;

/** What a rule set's leave unit means for the balance, in plain words. */
export const LEAVE_UNIT_LABELS = {
  calendar: 'Calendar days — every day of the leave uses balance, weekends too; public holidays don’t',
  working: 'Working days — only scheduled working days use balance',
} as const;

export const LEAVE_UNIT_SHORT_LABELS = {
  calendar: 'counted in calendar days',
  working: 'counted in working days',
} as const;

/** How the daily leave pay is averaged, in plain words. */
export const RATE_BASIS_LABELS = {
  calendar_day: 'Per calendar day — average earnings spread over calendar days (minus public holidays)',
  working_day: 'Per working day — average earnings divided by days actually worked',
} as const;

export const RULE_SET_STATUS_LABELS = { active: 'Active', draft: 'Draft' } as const;

export const TAX_REGIME_LABELS = { it_park: 'IT Park', standard: 'Standard' } as const;
