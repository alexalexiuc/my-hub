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
