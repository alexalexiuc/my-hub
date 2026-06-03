'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { Button, ConfirmModal, IconButton, SwipeRow } from '@/components';
import { AttachmentIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { BookingTypeIcon } from '@/components';
import type { TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { TravelTimeDisplay } from './TravelTimeDisplay';
import { apiFetch } from '@/lib/utils';
import { BookingModal } from './BookingModal';
import { BookingExpandedPanel } from './BookingExpandedPanel';
import { bookingTypeLabels } from './ui';

type BookingsSectionProps = {
  activeTripId: number | null;
  canEdit: boolean;
  bookings: TripBookingExtended[];
  documentsByBookingId: Map<number, TripDocument[]>;
  onChanged: () => void;
};

export function BookingsSection({
  activeTripId,
  canEdit,
  bookings,
  documentsByBookingId,
  onChanged,
}: BookingsSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TripBookingExtended | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<TripBookingExtended | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);
  const [openRowId, setOpenRowId] = useState<number | null>(null);

  async function handleDelete() {
    if (!deletingBooking) return;
    await apiFetch(`/api/travel/bookings/${deletingBooking.id}`, { method: 'DELETE' });
    setDeletingBooking(null);
    onChanged();
  }

  function toggleExpand(bookingId: number) {
    setExpandedBookingId(prev => (prev === bookingId ? null : bookingId));
  }

  const headerAction =
    canEdit && activeTripId ? (
      <Button size="xs" variant="accent" onClick={() => setShowAddModal(true)}>
        + Add
      </Button>
    ) : null;

  return (
    <>
      {(showAddModal || editingBooking) && (
        <BookingModal
          editingBooking={editingBooking ?? undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingBooking(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingBooking(null);
            onChanged();
          }}
        />
      )}
      {deletingBooking && (
        <ConfirmModal
          title="Delete Reservation"
          message={`Delete "${deletingBooking.title}"?`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeletingBooking(null)}
        />
      )}

      <SectionCard title="Reservations" className="bg-[var(--card)] border-[var(--border)]" action={headerAction}>
        <div className="max-h-[28rem] space-y-2 overflow-auto">
          {bookings.map(booking => (
            <div
              key={booking.id}
              className="overflow-hidden rounded-md border border-[var(--border)] text-sm"
              data-testid="booking-row"
            >
              {/* Mobile: swipe row */}
              <div data-layout="mobile" className="md:hidden">
                <SwipeRow
                  isOpen={openRowId === booking.id}
                  onOpen={() => setOpenRowId(booking.id)}
                  onClose={() => setOpenRowId(null)}
                  onEdit={canEdit ? () => setEditingBooking(booking) : undefined}
                  onDelete={canEdit ? () => setDeletingBooking(booking) : undefined}
                >
                  <BookingRowContent
                    booking={booking}
                    documentsByBookingId={documentsByBookingId}
                    expanded={expandedBookingId === booking.id}
                    onToggle={() => toggleExpand(booking.id)}
                    showActions={false}
                  />
                </SwipeRow>
              </div>

              {/* Desktop: hover buttons */}
              <div data-layout="desktop" className="hidden md:block">
                <BookingRowContent
                  booking={booking}
                  documentsByBookingId={documentsByBookingId}
                  expanded={expandedBookingId === booking.id}
                  onToggle={() => toggleExpand(booking.id)}
                  showActions={canEdit}
                  onEdit={() => setEditingBooking(booking)}
                  onDelete={() => setDeletingBooking(booking)}
                />
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-sm text-[var(--muted)]">No reservations yet.</p>}
        </div>
      </SectionCard>
    </>
  );
}

type BookingRowContentProps = {
  booking: TripBookingExtended;
  documentsByBookingId: Map<number, TripDocument[]>;
  expanded: boolean;
  onToggle: () => void;
  showActions: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

function BookingRowContent({
  booking,
  documentsByBookingId,
  expanded,
  onToggle,
  showActions,
  onEdit,
  onDelete,
}: BookingRowContentProps) {
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--card2)]"
        onClick={onToggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--text)]">{booking.title}</p>
          <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
            <BookingTypeIcon type={booking.bookingType} />
            {bookingTypeLabels[booking.bookingType as keyof typeof bookingTypeLabels] ?? booking.bookingType}
            {booking.provider ? ` · ${booking.provider}` : ''}
            {booking.startAt && (
              <>
                <span aria-hidden="true">·</span>
                <TravelTimeDisplay
                  datetime={new Date(booking.startAt).toISOString()}
                  timezone={booking.startTimezone ?? null}
                  size="xs"
                  showTimezoneOffset
                />
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(documentsByBookingId.get(booking.id)?.length ?? 0) > 0 && (
            <span className="text-[var(--amber)]" title="Has attachments">
              <AttachmentIcon />
            </span>
          )}
          <span className="text-xs text-[var(--subtle)]">{expanded ? '▲' : '▼'}</span>
          {showActions && (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <IconButton label="Edit reservation" onClick={onEdit} icon={<PencilIcon />} />
              <IconButton label="Delete reservation" onClick={onDelete} icon={<TrashIcon />} />
            </div>
          )}
        </div>
      </div>
      {expanded && <BookingExpandedPanel booking={booking} documents={documentsByBookingId.get(booking.id) ?? []} />}
    </>
  );
}
