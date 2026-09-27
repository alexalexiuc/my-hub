'use client';

import { Sidebar } from '@/components';
import { VACATION_NAV_ITEMS } from './constants';

export function VacationSidebar() {
  return (
    <Sidebar
      items={VACATION_NAV_ITEMS}
      header={
        <div className="text-base font-bold tracking-[-0.02em] text-[var(--text)]">
          <span className="text-[var(--accent)]">☀ </span>Vacation
        </div>
      }
    />
  );
}
