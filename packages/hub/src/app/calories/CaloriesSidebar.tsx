'use client';

import { useState } from 'react';
import { Sidebar, Button } from '@/components';
import type { SidebarNavItem } from '@/components';
import { MealModal } from './MealModal';
import { mealEvents } from './mealEvents';
import { dateToString } from '@my-hub/shared/utils';

const NAV_ITEMS: SidebarNavItem[] = [
  { id: 'today', label: 'Today', icon: '◉', path: '/calories', exact: true },
  { id: 'progress', label: 'Progress', icon: '▲', path: '/calories/progress' },
  { id: 'calendar', label: 'Calendar', icon: '📅', path: '/calories/calendar' },
  { id: 'menu', label: 'Weekly Menu', icon: '🗓', path: '/calories/menu' },
  { id: 'reports', label: 'Reports', icon: '▦', path: '/calories/reports' },
  { id: 'settings', label: 'Settings', icon: '⚙', path: '/calories/settings' },
];

export function CaloriesSidebar() {
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
      <Sidebar
        items={NAV_ITEMS}
        header={
          <div className="text-base font-bold tracking-[-0.02em] text-[var(--text)]">
            <span className="text-[var(--accent)]">◉ </span>Calories
          </div>
        }
        action={
          <Button onClick={() => setShowAddMeal(true)} variant="accent" className="w-full">
            Add Meal
          </Button>
        }
      />
    </>
  );
}
