'use client';

import { useState } from 'react';
import { BottomNav } from '@/components';
import type { BottomNavItem } from '@/components';
import { BookingModal } from './BookingModal';
import { travelEvents } from './travelEvents';

const LEFT_ITEMS: BottomNavItem[] = [
  { id: 'itinerary', icon: '◷', label: 'Itinerary', path: '/travel', exact: true },
  { id: 'bookings', icon: '◻', label: 'Bookings', path: '/travel/bookings' },
];

const RIGHT_ITEMS: BottomNavItem[] = [
  { id: 'checklist', icon: '✓', label: 'Checklist', path: '/travel/checklist' },
  { id: 'more', icon: '⋯', label: 'More', path: '/travel/more' },
];

export function TravelBottomNav() {
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
      <BottomNav
        leftItems={LEFT_ITEMS}
        rightItems={RIGHT_ITEMS}
        fab={{ label: 'Add', onClick: () => setShowAddBooking(true) }}
      />
    </>
  );
}
