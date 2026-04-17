'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { TripBookingType, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { AttachmentIcon, PencilIcon, PlusOutlineIcon, TrashIcon } from '@/components/icons';
import { BookingTypeIcon, Button, IconButton } from '@/components';
import { TravelTimeDisplay } from './TravelTimeDisplay';
import { TripBookingTypes } from '@my-hub/shared/constants';
import { apiFetch } from '@/lib/utils';
import { BookingForm } from './BookingForm';
import { bookingToFormValues, formToCreateBody, formToUpdateBody, type BookingFormValues } from './booking-form.schema';
import { BookingExpandedPanel } from './BookingExpandedPanel';

const bookingTypeLabels: Record<TripBookingType, string> = {
  [TripBookingTypes.Flight]: 'Flight',
  [TripBookingTypes.Accommodation]: 'Accommodation',
  [TripBookingTypes.RentalCar]: 'Rental Car',
  [TripBookingTypes.Train]: 'Train',
  [TripBookingTypes.Bus]: 'Bus',
  [TripBookingTypes.Ferry]: 'Ferry',
  [TripBookingTypes.Taxi]: 'Taxi',
  [TripBookingTypes.Transfer]: 'Transfer',
  [TripBookingTypes.Car]: 'Car',
  [TripBookingTypes.Restaurant]: 'Restaurant',
  [TripBookingTypes.Tour]: 'Tour',
  [TripBookingTypes.Activity]: 'Activity',
  [TripBookingTypes.Other]: 'Other',
};

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
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [showingCreateForm, setShowingCreateForm] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);

  async function addBooking(values: BookingFormValues) {
    if (!activeTripId || !canEdit) return;
    await apiFetch('/api/travel/bookings', { method: 'POST', body: formToCreateBody(values, activeTripId) });
    setShowingCreateForm(false);
    onChanged();
  }

  async function removeBooking(bookingId: number) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/bookings/${bookingId}`, { method: 'DELETE' });
    onChanged();
  }

  async function saveBookingEdits(bookingId: number, values: BookingFormValues) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/bookings/${bookingId}`, { method: 'PATCH', body: formToUpdateBody(values) });
    setEditingBookingId(null);
    onChanged();
  }

  function toggleExpand(bookingId: number) {
    setExpandedBookingId(prev => (prev === bookingId ? null : bookingId));
  }

  return (
    <SectionCard title="Reservations" className="bg-indigo-950/20 border-indigo-800/50">
      <div className="mb-3">
        {showingCreateForm ? (
          <BookingForm
            onSubmit={addBooking}
            onCancel={() => setShowingCreateForm(false)}
            submitLabel="Add Reservation"
            disabled={!activeTripId || !canEdit}
          />
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowingCreateForm(true)}
            disabled={!activeTripId || !canEdit}
          >
            <PlusOutlineIcon /> Add Reservation
          </Button>
        )}
      </div>

      <div className="space-y-2 max-h-[28rem] overflow-auto">
        {bookings.map(booking => (
          <div
            key={booking.id}
            className="rounded-md border border-zinc-700 bg-zinc-900 text-sm"
            data-testid="booking-row"
          >
            {editingBookingId === booking.id ? (
              <div className="px-3 py-2">
                <BookingForm
                  defaultValues={bookingToFormValues(booking)}
                  onSubmit={values => saveBookingEdits(booking.id, values)}
                  onCancel={() => setEditingBookingId(null)}
                  submitLabel="Save"
                />
              </div>
            ) : (
              <>
                {/* Clickable header row */}
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-800/40 transition-colors rounded-md cursor-pointer"
                  onClick={() => toggleExpand(booking.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(booking.id);
                    }
                  }}
                  aria-expanded={expandedBookingId === booking.id}
                  aria-label={`${expandedBookingId === booking.id ? 'Collapse' : 'Expand'} reservation: ${booking.title}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{booking.title}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-400">
                        <BookingTypeIcon type={booking.bookingType} />
                        {bookingTypeLabels[booking.bookingType as keyof typeof bookingTypeLabels] ??
                          booking.bookingType}
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
                        {booking.endAt && (
                          <>
                            <span aria-hidden="true">→</span>
                            <TravelTimeDisplay
                              datetime={new Date(booking.endAt).toISOString()}
                              timezone={booking.endTimezone ?? null}
                              size="xs"
                              showTimezoneOffset
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(documentsByBookingId.get(booking.id)?.length ?? 0) > 0 && (
                      <span className="text-amber-300" title="Has attachments">
                        <AttachmentIcon />
                      </span>
                    )}
                    <span className="text-zinc-500 text-xs">{expandedBookingId === booking.id ? '▲' : '▼'}</span>
                    {canEdit && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <IconButton
                          label="Edit reservation"
                          onClick={() => setEditingBookingId(booking.id)}
                          icon={<PencilIcon />}
                        />
                        <IconButton
                          label="Remove reservation"
                          onClick={() => removeBooking(booking.id)}
                          icon={<TrashIcon />}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded details panel */}
                {expandedBookingId === booking.id && (
                  <BookingExpandedPanel booking={booking} documents={documentsByBookingId.get(booking.id) ?? []} />
                )}
              </>
            )}
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-zinc-500">No reservations yet.</p>}
      </div>
    </SectionCard>
  );
}
