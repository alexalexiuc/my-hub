'use client';

import { useState } from 'react';
import { Sidebar, Button } from '@/components';
import type { SidebarNavItem } from '@/components';
import { BookingModal } from './BookingModal';
import { travelEvents } from './travelEvents';

const NAV_ITEMS: SidebarNavItem[] = [
  { id: 'itinerary', label: 'Itinerary', icon: '◷', path: '/travel', exact: true },
  { id: 'bookings', label: 'Bookings', icon: '◻', path: '/travel/bookings' },
  { id: 'map', label: 'Map', icon: '⊕', path: '/travel/map' },
  { id: 'calendar', label: 'Calendar', icon: '▦', path: '/travel/calendar' },
  { id: 'checklist', label: 'Checklist', icon: '✓', path: '/travel/checklist', dividerBefore: true },
  { id: 'companions', label: 'Companions', icon: '◎', path: '/travel/companions' },
  { id: 'documents', label: 'Documents', icon: '⊡', path: '/travel/documents' },
  { id: 'sharing', label: 'Sharing', icon: '⇡', path: '/travel/sharing' },
];

export function TravelSidebar() {
  const [showAddBooking, setShowAddBooking] = useState(false);

  return (
    <>
      {showAddBooking && (
        <BookingModal
          onClose={() => setShowAddBooking(false)}
          onSaved={() => {
            setShowAddBooking(false);
            travelEvents.emit('changed');
          }}
        />
      )}
      <Sidebar
        items={NAV_ITEMS}
        header={
          <div className="text-base font-bold tracking-[-0.02em] text-[var(--text)]">
            <span className="text-[var(--accent)]">✈ </span>Travel
          </div>
        }
        action={
          <Button onClick={() => setShowAddBooking(true)} variant="accent" className="w-full">
            Add Booking
          </Button>
        }
      />
    </>
  );
}
