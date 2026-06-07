'use client';

import { useState } from 'react';
import { BottomNav } from '@/components';
import type { BottomNavItem } from '@/components';
import { MealModal } from './MealModal';
import { mealEvents } from './mealEvents';
import { dateToString } from '@my-hub/shared/utils';

const LEFT_ITEMS: BottomNavItem[] = [
  { id: 'today', icon: '◉', label: 'Today', path: '/calories', exact: true },
  { id: 'progress', icon: '▲', label: 'Progress', path: '/calories/progress' },
];

const RIGHT_ITEMS: BottomNavItem[] = [
  { id: 'menu', icon: '🗓', label: 'Menu', path: '/calories/menu' },
  { id: 'reports', icon: '▦', label: 'Reports', path: '/calories/reports' },
  { id: 'settings', icon: '⚙', label: 'Settings', path: '/calories/settings' },
];

export function CaloriesBottomNav() {
  const [showAddMeal, setShowAddMeal] = useState(false);

  return (
    <>
      {showAddMeal && (
        <MealModal
          date={dateToString(new Date())}
          onClose={() => setShowAddMeal(false)}
          onSaved={() => {
            setShowAddMeal(false);
            mealEvents.emit('changed');
          }}
        />
      )}
      <BottomNav
        leftItems={LEFT_ITEMS}
        rightItems={RIGHT_ITEMS}
        fab={{ label: 'Add', onClick: () => setShowAddMeal(true) }}
      />
    </>
  );
}
