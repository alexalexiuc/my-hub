'use client';

import { BottomNav } from '@/components';
import { VACATION_NAV_ITEMS } from './constants';

// Four tabs split two a side keeps the bar balanced without a FAB or a "More" sheet.
const LEFT_ITEMS = VACATION_NAV_ITEMS.slice(0, 2);
const RIGHT_ITEMS = VACATION_NAV_ITEMS.slice(2);

export function VacationBottomNav() {
  return <BottomNav leftItems={LEFT_ITEMS} rightItems={RIGHT_ITEMS} />;
}
