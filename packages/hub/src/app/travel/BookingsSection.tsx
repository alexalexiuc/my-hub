'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { FlightDetails, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { AttachmentIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { IconButton } from '@/components';

const bookingTypeOptions = [
  'flight',
  'accommodation',
  'rental_car',
  'train',
  'bus',
  'ferry',
  'taxi',
  'restaurant',
  'tour',
  'activity',
  'ticket',
  'other',
] as const;

const bookingTypeLabels: Record<(typeof bookingTypeOptions)[number], string> = {
  flight: 'Flight',
  accommodation: 'Accommodation',
  rental_car: 'Rental Car',
  train: 'Train',
  bus: 'Bus',
  ferry: 'Ferry',
  taxi: 'Taxi / Transfer',
  restaurant: 'Restaurant',
  tour: 'Tour',
  activity: 'Activity',
  ticket: 'Ticket',
  other: 'Other',
};

function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

interface BookingsSectionProps {
  activeTripId: number | null;
  canEdit: boolean;
  bookings: TripBookingExtended[];
  documentsByBookingId: Map<number, TripDocument[]>;
  onChanged: () => void;
}

export function BookingsSection({
  activeTripId,
  canEdit,
  bookings,
  documentsByBookingId,
  onChanged,
}: BookingsSectionProps) {
  const [newBookingTitle, setNewBookingTitle] = useState('');
  const [newBookingType, setNewBookingType] = useState<(typeof bookingTypeOptions)[number]>('other');
  const [newBookingProvider, setNewBookingProvider] = useState('');
  const [newBookingStartAt, setNewBookingStartAt] = useState('');
  const [newBookingEndAt, setNewBookingEndAt] = useState('');
  const [newFlightNumber, setNewFlightNumber] = useState('');
  const [newFlightSeat, setNewFlightSeat] = useState('');
  const [newFlightOriginIata, setNewFlightOriginIata] = useState('');
  const [newFlightDestIata, setNewFlightDestIata] = useState('');
  const [newFlightTerminal, setNewFlightTerminal] = useState('');
  const [newFlightGate, setNewFlightGate] = useState('');

  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editBookingTitle, setEditBookingTitle] = useState('');
  const [editBookingType, setEditBookingType] = useState<(typeof bookingTypeOptions)[number]>('other');
  const [editBookingProvider, setEditBookingProvider] = useState('');
  const [editBookingStartAt, setEditBookingStartAt] = useState('');
  const [editBookingEndAt, setEditBookingEndAt] = useState('');
  const [editFlightNumber, setEditFlightNumber] = useState('');
  const [editFlightSeat, setEditFlightSeat] = useState('');
  const [editFlightOriginIata, setEditFlightOriginIata] = useState('');
  const [editFlightDestIata, setEditFlightDestIata] = useState('');
  const [editFlightTerminal, setEditFlightTerminal] = useState('');
  const [editFlightGate, setEditFlightGate] = useState('');

  async function addBooking() {
    if (!activeTripId || !canEdit || !newBookingTitle.trim()) return;
    const body: Record<string, unknown> = {
      trip_id: activeTripId,
      title: newBookingTitle.trim(),
      booking_type: newBookingType,
      provider: newBookingProvider.trim() || undefined,
      start_at: newBookingStartAt ? new Date(newBookingStartAt).toISOString() : undefined,
      end_at: newBookingEndAt ? new Date(newBookingEndAt).toISOString() : undefined,
    };
    if (newBookingType === 'flight') {
      body.flight_details = {
        ...(newFlightNumber.trim() && { flight_number: newFlightNumber.trim() }),
        ...(newFlightSeat.trim() && { seat: newFlightSeat.trim() }),
        ...(newFlightOriginIata.trim() && { origin_iata: newFlightOriginIata.trim().toUpperCase() }),
        ...(newFlightDestIata.trim() && { destination_iata: newFlightDestIata.trim().toUpperCase() }),
        ...(newFlightTerminal.trim() && { terminal: newFlightTerminal.trim() }),
        ...(newFlightGate.trim() && { gate: newFlightGate.trim() }),
      };
    }
    await fetch('/api/travel/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setNewBookingTitle('');
    setNewBookingProvider('');
    setNewBookingStartAt('');
    setNewBookingEndAt('');
    setNewFlightNumber('');
    setNewFlightSeat('');
    setNewFlightOriginIata('');
    setNewFlightDestIata('');
    setNewFlightTerminal('');
    setNewFlightGate('');
    onChanged();
  }

  async function removeBooking(bookingId: number) {
    if (!activeTripId || !canEdit) return;
    await fetch(`/api/travel/bookings/${bookingId}`, { method: 'DELETE' });
    onChanged();
  }

  function startEditBooking(booking: TripBookingExtended) {
    setEditingBookingId(booking.id);
    setEditBookingTitle(booking.title);
    setEditBookingType(booking.bookingType as (typeof bookingTypeOptions)[number]);
    setEditBookingProvider(booking.provider ?? '');
    setEditBookingStartAt(toDateTimeLocalValue(booking.startAt));
    setEditBookingEndAt(toDateTimeLocalValue(booking.endAt));
    const fd = (booking.details ?? {}) as FlightDetails;
    setEditFlightNumber(fd.flight_number ?? '');
    setEditFlightSeat(fd.seat ?? '');
    setEditFlightOriginIata(fd.origin_iata ?? '');
    setEditFlightDestIata(fd.destination_iata ?? '');
    setEditFlightTerminal(fd.terminal ?? '');
    setEditFlightGate(fd.gate ?? '');
  }

  function cancelEditBooking() {
    setEditingBookingId(null);
    setEditBookingTitle('');
    setEditBookingType('other');
    setEditBookingProvider('');
    setEditBookingStartAt('');
    setEditBookingEndAt('');
    setEditFlightNumber('');
    setEditFlightSeat('');
    setEditFlightOriginIata('');
    setEditFlightDestIata('');
    setEditFlightTerminal('');
    setEditFlightGate('');
  }

  async function saveBookingEdits(bookingId: number) {
    if (!activeTripId || !canEdit || !editBookingTitle.trim()) return;
    const body: Record<string, unknown> = {
      title: editBookingTitle.trim(),
      booking_type: editBookingType,
      provider: editBookingProvider.trim() || null,
      start_at: editBookingStartAt ? new Date(editBookingStartAt).toISOString() : null,
      end_at: editBookingEndAt ? new Date(editBookingEndAt).toISOString() : null,
    };
    if (editBookingType === 'flight') {
      body.flight_details = {
        ...(editFlightNumber.trim() && { flight_number: editFlightNumber.trim() }),
        ...(editFlightSeat.trim() && { seat: editFlightSeat.trim() }),
        ...(editFlightOriginIata.trim() && { origin_iata: editFlightOriginIata.trim().toUpperCase() }),
        ...(editFlightDestIata.trim() && { destination_iata: editFlightDestIata.trim().toUpperCase() }),
        ...(editFlightTerminal.trim() && { terminal: editFlightTerminal.trim() }),
        ...(editFlightGate.trim() && { gate: editFlightGate.trim() }),
      };
    }
    await fetch(`/api/travel/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    cancelEditBooking();
    onChanged();
  }

  return (
    <SectionCard title="Reservations" className="bg-indigo-950/20 border-indigo-800/50">
      <div className="space-y-2 mb-3">
        <input
          value={newBookingTitle}
          onChange={(e) => setNewBookingTitle(e.target.value)}
          placeholder="Reservation title"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={newBookingType}
            onChange={(e) => setNewBookingType(e.target.value as (typeof bookingTypeOptions)[number])}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            {bookingTypeOptions.map((type) => (
              <option key={type} value={type}>
                {bookingTypeLabels[type]}
              </option>
            ))}
          </select>
          <input
            value={newBookingProvider}
            onChange={(e) => setNewBookingProvider(e.target.value)}
            placeholder="Provider"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <input
          type="datetime-local"
          value={newBookingStartAt}
          onChange={(e) => setNewBookingStartAt(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={newBookingEndAt}
          onChange={(e) => setNewBookingEndAt(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        {newBookingType === 'flight' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newFlightNumber}
              onChange={(e) => setNewFlightNumber(e.target.value)}
              placeholder="Flight no. (e.g. BA2490)"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <input
              value={newFlightSeat}
              onChange={(e) => setNewFlightSeat(e.target.value)}
              placeholder="Seat (e.g. 14A)"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <input
              value={newFlightOriginIata}
              onChange={(e) => setNewFlightOriginIata(e.target.value)}
              placeholder="From IATA (e.g. LHR)"
              maxLength={3}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm uppercase"
            />
            <input
              value={newFlightDestIata}
              onChange={(e) => setNewFlightDestIata(e.target.value)}
              placeholder="To IATA (e.g. CDG)"
              maxLength={3}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm uppercase"
            />
            <input
              value={newFlightTerminal}
              onChange={(e) => setNewFlightTerminal(e.target.value)}
              placeholder="Terminal"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <input
              value={newFlightGate}
              onChange={(e) => setNewFlightGate(e.target.value)}
              placeholder="Gate"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
        )}
        <button
          onClick={addBooking}
          disabled={!activeTripId || !canEdit}
          className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Add Reservation
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-auto">
        {bookings.map((booking) => (
          <div key={booking.id} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
            {editingBookingId === booking.id ? (
              <div className="space-y-2">
                <input
                  value={editBookingTitle}
                  onChange={(e) => setEditBookingTitle(e.target.value)}
                  placeholder="Reservation title"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editBookingType}
                    onChange={(e) => setEditBookingType(e.target.value as (typeof bookingTypeOptions)[number])}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  >
                    {bookingTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {bookingTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editBookingProvider}
                    onChange={(e) => setEditBookingProvider(e.target.value)}
                    placeholder="Provider"
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    value={editBookingStartAt}
                    onChange={(e) => setEditBookingStartAt(e.target.value)}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={editBookingEndAt}
                    onChange={(e) => setEditBookingEndAt(e.target.value)}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                </div>
                {editBookingType === 'flight' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editFlightNumber}
                      onChange={(e) => setEditFlightNumber(e.target.value)}
                      placeholder="Flight no. (e.g. BA2490)"
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editFlightSeat}
                      onChange={(e) => setEditFlightSeat(e.target.value)}
                      placeholder="Seat (e.g. 14A)"
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editFlightOriginIata}
                      onChange={(e) => setEditFlightOriginIata(e.target.value)}
                      placeholder="From IATA (e.g. LHR)"
                      maxLength={3}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm uppercase"
                    />
                    <input
                      value={editFlightDestIata}
                      onChange={(e) => setEditFlightDestIata(e.target.value)}
                      placeholder="To IATA (e.g. CDG)"
                      maxLength={3}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm uppercase"
                    />
                    <input
                      value={editFlightTerminal}
                      onChange={(e) => setEditFlightTerminal(e.target.value)}
                      placeholder="Terminal"
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editFlightGate}
                      onChange={(e) => setEditFlightGate(e.target.value)}
                      placeholder="Gate"
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => saveBookingEdits(booking.id)}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditBooking}
                    className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{booking.title}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-400">
                      {booking.bookingType}
                      {booking.provider ? ` · ${booking.provider}` : ''}
                      {booking.startAt ? ` · ${new Date(booking.startAt).toLocaleString()}` : ''}
                      {booking.endAt ? ` → ${new Date(booking.endAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  {booking.bookingType === 'flight' &&
                    (() => {
                      const fd = booking.flightData;
                      const d = (booking.details ?? {}) as FlightDetails;
                      const flightNo = fd?.flightNumber ?? d.flight_number;
                      const origin = fd?.originIata ?? d.origin_iata;
                      const dest = fd?.destinationIata ?? d.destination_iata;
                      const terminal = fd?.departureTerminal ?? d.terminal;
                      const gate = fd?.departureGate ?? d.gate;
                      const status = fd?.status;
                      const seat = d.seat;
                      const parts = [
                        flightNo,
                        origin && dest ? `${origin}→${dest}` : (origin ?? dest),
                        seat && `Seat ${seat}`,
                        terminal && `T${terminal}`,
                        gate && `Gate ${gate}`,
                        status && status !== 'scheduled' && status,
                      ].filter(Boolean);
                      if (parts.length === 0) return null;
                      return (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-sky-400">{parts.join(' · ')}</p>
                        </div>
                      );
                    })()}
                  <div className="flex items-center gap-2">
                    {(documentsByBookingId.get(booking.id)?.length ?? 0) > 0 && (
                      <div className="relative group" aria-label="Booking attachments" title="Booking attachments">
                        <button
                          type="button"
                          className="rounded p-0.5 text-amber-300 hover:text-amber-200"
                          aria-label="Show booking attachments"
                        >
                          <AttachmentIcon />
                        </button>
                        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-950 p-2 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Attachments</p>
                          <ul className="space-y-1">
                            {documentsByBookingId.get(booking.id)?.map((doc) => (
                              <li key={doc.id} className="text-xs text-zinc-200">
                                {doc.storagePath ? (
                                  <a
                                    className="pointer-events-auto hover:underline"
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
                      </div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <IconButton
                      label="Edit reservation"
                      onClick={() => startEditBooking(booking)}
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
            )}
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-zinc-500">No reservations yet.</p>}
      </div>
    </SectionCard>
  );
}
