'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { FlightDetails, TransportDetails, TripBookingType, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { AttachmentIcon, PencilIcon, PlusOutlineIcon, TrashIcon } from '@/components/icons';
import { BookingTypeIcon, Button, IconButton } from '@/components';
import { TravelTimeDisplay } from './TravelTimeDisplay';
import { TripBookingTypes } from '@my-hub/shared/constants';
import { isTransportBookingType } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import { BookingForm } from './BookingForm';
import { bookingToFormValues, formToCreateBody, formToUpdateBody, type BookingFormValues } from './booking-form.schema';

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
                  <div className="px-3 pb-3 pt-1 border-t border-zinc-700/50 space-y-2">
                    {booking.bookingType === 'flight' &&
                      (() => {
                        const fd = booking.flightData;
                        const d = (booking.details ?? {}) as FlightDetails;
                        const flightNo = fd?.flightNumber ?? d.flightNumber;
                        const origin = fd?.originIata ?? d.originIata;
                        const dest = fd?.destinationIata ?? d.destinationIata;
                        const terminal = fd?.departureTerminal ?? d.terminal;
                        const gate = fd?.departureGate ?? d.gate;
                        const { seat } = d;
                        const status = fd?.status;
                        const parts = [
                          flightNo,
                          origin && dest ? `${origin}→${dest}` : (origin ?? dest),
                          terminal && `T${terminal}`,
                          gate && `Gate ${gate}`,
                          seat && `Seat ${seat}`,
                          status && status !== 'scheduled' && status,
                        ].filter(Boolean);
                        if (parts.length === 0) return null;
                        return <p className="text-xs text-sky-400">{parts.join(' · ')}</p>;
                      })()}

                    {isTransportBookingType(booking.bookingType) &&
                      (() => {
                        const d = booking.details as { kind?: string } | null;
                        if (d?.kind !== 'transport') return null;
                        const td = booking.details as TransportDetails;
                        const parts = [
                          `${td.origin.name} → ${td.destination.name}`,
                          td.serviceNumber,
                          td.seat && `Seat ${td.seat}`,
                          td.class,
                          td.vehicleType,
                          td.meetingPoint && `Meet: ${td.meetingPoint}`,
                        ].filter(Boolean);
                        return <p className="text-xs text-emerald-400">{parts.join(' · ')}</p>;
                      })()}

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {booking.location && (
                        <>
                          <dt className="text-zinc-500">Location</dt>
                          <dd className="text-zinc-300">{booking.location}</dd>
                        </>
                      )}
                      {booking.confirmationNumber && (
                        <>
                          <dt className="text-zinc-500">Confirmation</dt>
                          <dd className="text-zinc-300 font-mono">{booking.confirmationNumber}</dd>
                        </>
                      )}
                      {booking.status && (
                        <>
                          <dt className="text-zinc-500">Status</dt>
                          <dd className="text-zinc-300">{booking.status}</dd>
                        </>
                      )}
                      {booking.referenceLink && (
                        <>
                          <dt className="text-zinc-500">Reference link</dt>
                          <dd className="text-zinc-300 truncate">
                            <a
                              href={booking.referenceLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-300 hover:underline"
                            >
                              Open link
                            </a>
                          </dd>
                        </>
                      )}
                      {booking.startAt && (
                        <>
                          <dt className="text-zinc-500">Start</dt>
                          <dd className="text-zinc-300">
                            <TravelTimeDisplay
                              datetime={new Date(booking.startAt).toISOString()}
                              timezone={booking.startTimezone ?? null}
                              size="xs"
                              showTimezoneOffset
                            />
                          </dd>
                        </>
                      )}
                      {booking.endAt && (
                        <>
                          <dt className="text-zinc-500">End</dt>
                          <dd className="text-zinc-300">
                            <TravelTimeDisplay
                              datetime={new Date(booking.endAt).toISOString()}
                              timezone={booking.endTimezone ?? null}
                              size="xs"
                              showTimezoneOffset
                            />
                          </dd>
                        </>
                      )}
                      {booking.costAmount != null && (
                        <>
                          <dt className="text-zinc-500">Cost</dt>
                          <dd className="text-zinc-300">
                            {booking.costAmount} {booking.costCurrency}
                          </dd>
                        </>
                      )}
                    </dl>

                    {(booking.contactName || booking.contactEmail || booking.contactPhone) && (
                      <div className="border-t border-zinc-700/40 pt-2">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1">Contact</p>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {booking.contactName && (
                            <>
                              <dt className="text-zinc-500">Name</dt>
                              <dd className="text-zinc-300">{booking.contactName}</dd>
                            </>
                          )}
                          {booking.contactPhone && (
                            <>
                              <dt className="text-zinc-500">Phone</dt>
                              <dd className="text-zinc-300">
                                <a href={`tel:${booking.contactPhone}`} className="text-amber-300 hover:underline">
                                  {booking.contactPhone}
                                </a>
                              </dd>
                            </>
                          )}
                          {booking.contactEmail && (
                            <>
                              <dt className="text-zinc-500">Email</dt>
                              <dd className="text-zinc-300">
                                <a href={`mailto:${booking.contactEmail}`} className="text-amber-300 hover:underline">
                                  {booking.contactEmail}
                                </a>
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    )}

                    {booking.notes && (
                      <p className="text-xs text-zinc-400 italic border-t border-zinc-700/40 pt-2">{booking.notes}</p>
                    )}

                    {(documentsByBookingId.get(booking.id)?.length ?? 0) > 0 && (
                      <div className="border-t border-zinc-700/40 pt-2">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1">Attachments</p>
                        <ul className="space-y-1">
                          {documentsByBookingId.get(booking.id)?.map(doc => (
                            <li key={doc.id} className="text-xs text-zinc-200">
                              {doc.storagePath ? (
                                <a
                                  className="hover:underline text-amber-300"
                                  href={`/api/travel/documents/${doc.id}/download`}
                                >
                                  {doc.title}
                                </a>
                              ) : (
                                <span>{doc.title}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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
