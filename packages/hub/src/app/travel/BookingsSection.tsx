'use client';

import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import type { FlightDetails, TransportDetails, TripBookingType, TripDocument } from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { AttachmentIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { BookingTypeIcon, Button, IconButton, Input, Select } from '@/components';
import { TravelTimeDisplay } from './TravelTimeDisplay';
import { TripBookingTypes, tripBookingTypeValues } from '@my-hub/shared/constants';
import { isTransportBookingType, toDateTimeLocalValue } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';

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
  const [newBookingTitle, setNewBookingTitle] = useState('');
  const [newBookingType, setNewBookingType] = useState<TripBookingType>(TripBookingTypes.Other);
  const [newBookingProvider, setNewBookingProvider] = useState('');
  const [newBookingReferenceLink, setNewBookingReferenceLink] = useState('');
  const [newBookingStartAt, setNewBookingStartAt] = useState('');
  const [newBookingEndAt, setNewBookingEndAt] = useState('');
  const [newFlightNumber, setNewFlightNumber] = useState('');
  const [newFlightSeat, setNewFlightSeat] = useState('');
  const [newFlightOriginIata, setNewFlightOriginIata] = useState('');
  const [newFlightDestIata, setNewFlightDestIata] = useState('');
  const [newFlightTerminal, setNewFlightTerminal] = useState('');
  const [newFlightGate, setNewFlightGate] = useState('');
  const [newTransportOrigin, setNewTransportOrigin] = useState('');
  const [newTransportDest, setNewTransportDest] = useState('');
  const [newTransportServiceNumber, setNewTransportServiceNumber] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editBookingTitle, setEditBookingTitle] = useState('');
  const [editBookingType, setEditBookingType] = useState<TripBookingType>(TripBookingTypes.Other);
  const [editBookingProvider, setEditBookingProvider] = useState('');
  const [editBookingReferenceLink, setEditBookingReferenceLink] = useState('');
  const [editBookingStartAt, setEditBookingStartAt] = useState('');
  const [editBookingEndAt, setEditBookingEndAt] = useState('');
  const [editFlightNumber, setEditFlightNumber] = useState('');
  const [editFlightSeat, setEditFlightSeat] = useState('');
  const [editFlightOriginIata, setEditFlightOriginIata] = useState('');
  const [editFlightDestIata, setEditFlightDestIata] = useState('');
  const [editFlightTerminal, setEditFlightTerminal] = useState('');
  const [editFlightGate, setEditFlightGate] = useState('');
  const [editTransportOrigin, setEditTransportOrigin] = useState('');
  const [editTransportDest, setEditTransportDest] = useState('');
  const [editTransportServiceNumber, setEditTransportServiceNumber] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);

  async function addBooking() {
    if (!activeTripId || !canEdit || !newBookingTitle.trim()) return;
    const body: Record<string, unknown> = {
      trip_id: activeTripId,
      title: newBookingTitle.trim(),
      booking_type: newBookingType,
      provider: newBookingProvider.trim() || undefined,
      reference_link: newBookingReferenceLink.trim() || undefined,
      start_at: newBookingStartAt ? new Date(newBookingStartAt).toISOString() : undefined,
      end_at: newBookingEndAt ? new Date(newBookingEndAt).toISOString() : undefined,
    };
    if (newBookingType === TripBookingTypes.Flight) {
      body.flight_details = {
        kind: 'flight',
        ...(newFlightNumber.trim() && { flight_number: newFlightNumber.trim() }),
        ...(newFlightSeat.trim() && { seat: newFlightSeat.trim() }),
        ...(newFlightOriginIata.trim() && { origin_iata: newFlightOriginIata.trim().toUpperCase() }),
        ...(newFlightDestIata.trim() && { destination_iata: newFlightDestIata.trim().toUpperCase() }),
        ...(newFlightTerminal.trim() && { terminal: newFlightTerminal.trim() }),
        ...(newFlightGate.trim() && { gate: newFlightGate.trim() }),
      };
    } else if (isTransportBookingType(newBookingType) && (newTransportOrigin.trim() || newTransportDest.trim())) {
      body.flight_details = {
        kind: 'transport',
        origin: { name: newTransportOrigin.trim() || '' },
        destination: { name: newTransportDest.trim() || '' },
        ...(newTransportServiceNumber.trim() && { service_number: newTransportServiceNumber.trim() }),
      };
      if (!body.location && newTransportOrigin.trim() && newTransportDest.trim()) {
        body.location = `${newTransportOrigin.trim()} → ${newTransportDest.trim()}`;
      }
    }
    if (newContactName.trim()) body.contact_name = newContactName.trim();
    if (newContactEmail.trim()) body.contact_email = newContactEmail.trim();
    if (newContactPhone.trim()) body.contact_phone = newContactPhone.trim();
    await apiFetch('/api/travel/bookings', { method: 'POST', body });
    setNewBookingTitle('');
    setNewBookingProvider('');
    setNewBookingReferenceLink('');
    setNewBookingStartAt('');
    setNewBookingEndAt('');
    setNewFlightNumber('');
    setNewFlightSeat('');
    setNewFlightOriginIata('');
    setNewFlightDestIata('');
    setNewFlightTerminal('');
    setNewFlightGate('');
    setNewTransportOrigin('');
    setNewTransportDest('');
    setNewTransportServiceNumber('');
    setNewContactName('');
    setNewContactEmail('');
    setNewContactPhone('');
    onChanged();
  }

  async function removeBooking(bookingId: number) {
    if (!activeTripId || !canEdit) return;
    await apiFetch(`/api/travel/bookings/${bookingId}`, { method: 'DELETE' });
    onChanged();
  }

  function startEditBooking(booking: TripBookingExtended) {
    setEditingBookingId(booking.id);
    setEditBookingTitle(booking.title);
    setEditBookingType(booking.bookingType as TripBookingType);
    setEditBookingProvider(booking.provider ?? '');
    setEditBookingReferenceLink(booking.referenceLink ?? '');
    setEditBookingStartAt(toDateTimeLocalValue(booking.startAt));
    setEditBookingEndAt(toDateTimeLocalValue(booking.endAt));
    const d = (booking.details ?? {}) as { kind?: string };
    if (d.kind === 'flight' || booking.bookingType === TripBookingTypes.Flight) {
      const fd = booking.details as FlightDetails;
      setEditFlightNumber(fd.flight_number ?? '');
      setEditFlightSeat(fd.seat ?? '');
      setEditFlightOriginIata(fd.origin_iata ?? '');
      setEditFlightDestIata(fd.destination_iata ?? '');
      setEditFlightTerminal(fd.terminal ?? '');
      setEditFlightGate(fd.gate ?? '');
    } else if (d.kind === 'transport') {
      const td = booking.details as TransportDetails;
      setEditTransportOrigin(td.origin.name);
      setEditTransportDest(td.destination.name);
      setEditTransportServiceNumber(td.service_number ?? '');
    }
    setEditContactName(booking.contactName ?? '');
    setEditContactEmail(booking.contactEmail ?? '');
    setEditContactPhone(booking.contactPhone ?? '');
  }

  function cancelEditBooking() {
    setEditingBookingId(null);
    setEditBookingTitle('');
    setEditBookingType('other');
    setEditBookingProvider('');
    setEditBookingReferenceLink('');
    setEditBookingStartAt('');
    setEditBookingEndAt('');
    setEditFlightNumber('');
    setEditFlightSeat('');
    setEditFlightOriginIata('');
    setEditFlightDestIata('');
    setEditFlightTerminal('');
    setEditFlightGate('');
    setEditTransportOrigin('');
    setEditTransportDest('');
    setEditTransportServiceNumber('');
    setEditContactName('');
    setEditContactEmail('');
    setEditContactPhone('');
  }

  async function saveBookingEdits(bookingId: number) {
    if (!activeTripId || !canEdit || !editBookingTitle.trim()) return;
    const body: Record<string, unknown> = {
      title: editBookingTitle.trim(),
      booking_type: editBookingType,
      provider: editBookingProvider.trim() || null,
      reference_link: editBookingReferenceLink.trim() || null,
      start_at: editBookingStartAt ? new Date(editBookingStartAt).toISOString() : null,
      end_at: editBookingEndAt ? new Date(editBookingEndAt).toISOString() : null,
    };
    if (editBookingType === TripBookingTypes.Flight) {
      body.flight_details = {
        kind: 'flight',
        ...(editFlightNumber.trim() && { flight_number: editFlightNumber.trim() }),
        ...(editFlightSeat.trim() && { seat: editFlightSeat.trim() }),
        ...(editFlightOriginIata.trim() && { origin_iata: editFlightOriginIata.trim().toUpperCase() }),
        ...(editFlightDestIata.trim() && { destination_iata: editFlightDestIata.trim().toUpperCase() }),
        ...(editFlightTerminal.trim() && { terminal: editFlightTerminal.trim() }),
        ...(editFlightGate.trim() && { gate: editFlightGate.trim() }),
      };
    } else if (isTransportBookingType(editBookingType) && (editTransportOrigin.trim() || editTransportDest.trim())) {
      body.flight_details = {
        kind: 'transport',
        origin: { name: editTransportOrigin.trim() },
        destination: { name: editTransportDest.trim() },
        ...(editTransportServiceNumber.trim() && { service_number: editTransportServiceNumber.trim() }),
      };
    }
    body.contact_name = editContactName.trim() || null;
    body.contact_email = editContactEmail.trim() || null;
    body.contact_phone = editContactPhone.trim() || null;
    await apiFetch(`/api/travel/bookings/${bookingId}`, { method: 'PATCH', body });
    cancelEditBooking();
    onChanged();
  }

  function toggleExpand(bookingId: number) {
    setExpandedBookingId((prev) => (prev === bookingId ? null : bookingId));
  }

  return (
    <SectionCard title="Reservations" className="bg-indigo-950/20 border-indigo-800/50">
      <div className="space-y-2 mb-3">
        <Input
          value={newBookingTitle}
          onChange={(e) => setNewBookingTitle(e.target.value)}
          placeholder="Reservation title"
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">
              <BookingTypeIcon type={newBookingType} />
            </span>
            <Select
              options={tripBookingTypeValues.map((type) => ({ value: type, label: bookingTypeLabels[type] }))}
              value={newBookingType}
              onChange={(e) => setNewBookingType(e.target.value as TripBookingType)}
            />
          </div>
          <Input
            value={newBookingProvider}
            onChange={(e) => setNewBookingProvider(e.target.value)}
            placeholder="Provider"
          />
        </div>
        <Input
          type="url"
          value={newBookingReferenceLink}
          onChange={(e) => setNewBookingReferenceLink(e.target.value)}
          placeholder="Reference link (e.g. https://booking.com/...)"
        />
        <Input type="datetime-local" value={newBookingStartAt} onChange={(e) => setNewBookingStartAt(e.target.value)} />
        <Input type="datetime-local" value={newBookingEndAt} onChange={(e) => setNewBookingEndAt(e.target.value)} />
        {newBookingType === 'flight' && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newFlightNumber}
              onChange={(e) => setNewFlightNumber(e.target.value)}
              placeholder="Flight no. (e.g. BA2490)"
            />
            <Input
              value={newFlightSeat}
              onChange={(e) => setNewFlightSeat(e.target.value)}
              placeholder="Seat (e.g. 14A)"
            />
            <Input
              value={newFlightOriginIata}
              onChange={(e) => setNewFlightOriginIata(e.target.value)}
              placeholder="From IATA (e.g. LHR)"
              maxLength={3}
              className="uppercase"
            />
            <Input
              value={newFlightDestIata}
              onChange={(e) => setNewFlightDestIata(e.target.value)}
              placeholder="To IATA (e.g. CDG)"
              maxLength={3}
              className="uppercase"
            />
            <Input
              value={newFlightTerminal}
              onChange={(e) => setNewFlightTerminal(e.target.value)}
              placeholder="Terminal"
            />
            <Input value={newFlightGate} onChange={(e) => setNewFlightGate(e.target.value)} placeholder="Gate" />
          </div>
        )}
        {isTransportBookingType(newBookingType) && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newTransportOrigin}
              onChange={(e) => setNewTransportOrigin(e.target.value)}
              placeholder="From (e.g. Paris Gare du Nord)"
            />
            <Input
              value={newTransportDest}
              onChange={(e) => setNewTransportDest(e.target.value)}
              placeholder="To (e.g. London St Pancras)"
            />
            <Input
              value={newTransportServiceNumber}
              onChange={(e) => setNewTransportServiceNumber(e.target.value)}
              placeholder="Service no. (e.g. TGV 6201)"
              className="col-span-2"
            />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Input
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
            placeholder="Contact name"
          />
          <Input
            type="email"
            value={newContactEmail}
            onChange={(e) => setNewContactEmail(e.target.value)}
            placeholder="Contact email"
          />
          <Input
            type="tel"
            value={newContactPhone}
            onChange={(e) => setNewContactPhone(e.target.value)}
            placeholder="Contact phone"
          />
        </div>
        <Button onClick={addBooking} disabled={!activeTripId || !canEdit} className="w-full">
          Add Reservation
        </Button>
      </div>

      <div className="space-y-2 max-h-[28rem] overflow-auto">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="rounded-md border border-zinc-700 bg-zinc-900 text-sm"
            data-testid="booking-row"
          >
            {editingBookingId === booking.id ? (
              <div className="space-y-2 px-3 py-2">
                <Input
                  value={editBookingTitle}
                  onChange={(e) => setEditBookingTitle(e.target.value)}
                  placeholder="Reservation title"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400">
                      <BookingTypeIcon type={editBookingType} />
                    </span>
                    <Select
                      options={tripBookingTypeValues.map((type) => ({ value: type, label: bookingTypeLabels[type] }))}
                      value={editBookingType}
                      onChange={(e) => setEditBookingType(e.target.value as TripBookingType)}
                    />
                  </div>
                  <Input
                    value={editBookingProvider}
                    onChange={(e) => setEditBookingProvider(e.target.value)}
                    placeholder="Provider"
                  />
                </div>
                <Input
                  type="url"
                  value={editBookingReferenceLink}
                  onChange={(e) => setEditBookingReferenceLink(e.target.value)}
                  placeholder="Reference link (e.g. https://booking.com/...)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="datetime-local"
                    value={editBookingStartAt}
                    onChange={(e) => setEditBookingStartAt(e.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={editBookingEndAt}
                    onChange={(e) => setEditBookingEndAt(e.target.value)}
                  />
                </div>
                {editBookingType === 'flight' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={editFlightNumber}
                      onChange={(e) => setEditFlightNumber(e.target.value)}
                      placeholder="Flight no. (e.g. BA2490)"
                    />
                    <Input
                      value={editFlightSeat}
                      onChange={(e) => setEditFlightSeat(e.target.value)}
                      placeholder="Seat (e.g. 14A)"
                    />
                    <Input
                      value={editFlightOriginIata}
                      onChange={(e) => setEditFlightOriginIata(e.target.value)}
                      placeholder="From IATA (e.g. LHR)"
                      maxLength={3}
                      className="uppercase"
                    />
                    <Input
                      value={editFlightDestIata}
                      onChange={(e) => setEditFlightDestIata(e.target.value)}
                      placeholder="To IATA (e.g. CDG)"
                      maxLength={3}
                      className="uppercase"
                    />
                    <Input
                      value={editFlightTerminal}
                      onChange={(e) => setEditFlightTerminal(e.target.value)}
                      placeholder="Terminal"
                    />
                    <Input
                      value={editFlightGate}
                      onChange={(e) => setEditFlightGate(e.target.value)}
                      placeholder="Gate"
                    />
                  </div>
                )}
                {isTransportBookingType(editBookingType) && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={editTransportOrigin}
                      onChange={(e) => setEditTransportOrigin(e.target.value)}
                      placeholder="From (e.g. Paris Gare du Nord)"
                    />
                    <Input
                      value={editTransportDest}
                      onChange={(e) => setEditTransportDest(e.target.value)}
                      placeholder="To (e.g. London St Pancras)"
                    />
                    <Input
                      value={editTransportServiceNumber}
                      onChange={(e) => setEditTransportServiceNumber(e.target.value)}
                      placeholder="Service no. (e.g. TGV 6201)"
                      className="col-span-2"
                    />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={editContactName}
                    onChange={(e) => setEditContactName(e.target.value)}
                    placeholder="Contact name"
                  />
                  <Input
                    type="email"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    placeholder="Contact email"
                  />
                  <Input
                    type="tel"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    placeholder="Contact phone"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button size="xs" onClick={() => saveBookingEdits(booking.id)}>
                    Save
                  </Button>
                  <Button variant="secondary" size="xs" onClick={cancelEditBooking}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Clickable header row */}
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-800/40 transition-colors rounded-md cursor-pointer"
                  onClick={() => toggleExpand(booking.id)}
                  onKeyDown={(e) => {
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
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                </div>

                {/* Expanded details panel */}
                {expandedBookingId === booking.id && (
                  <div className="px-3 pb-3 pt-1 border-t border-zinc-700/50 space-y-2">
                    {/* Flight info line */}
                    {booking.bookingType === 'flight' &&
                      (() => {
                        const fd = booking.flightData;
                        const d = (booking.details ?? {}) as FlightDetails;
                        const flightNo = fd?.flightNumber ?? d.flight_number;
                        const origin = fd?.originIata ?? d.origin_iata;
                        const dest = fd?.destinationIata ?? d.destination_iata;
                        const terminal = fd?.departureTerminal ?? d.terminal;
                        const gate = fd?.departureGate ?? d.gate;
                        const seat = d.seat;
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

                    {/* Transport info line */}
                    {isTransportBookingType(booking.bookingType) &&
                      (() => {
                        const d = booking.details as { kind?: string } | null;
                        if (d?.kind !== 'transport') return null;
                        const td = booking.details as TransportDetails;
                        const parts = [
                          `${td.origin.name} → ${td.destination.name}`,
                          td.service_number,
                          td.seat && `Seat ${td.seat}`,
                          td.class,
                          td.vehicle_type,
                          td.meeting_point && `Meet: ${td.meeting_point}`,
                        ].filter(Boolean);
                        return <p className="text-xs text-emerald-400">{parts.join(' · ')}</p>;
                      })()}

                    {/* Extra metadata grid */}
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

                    {/* Attachments */}
                    {(documentsByBookingId.get(booking.id)?.length ?? 0) > 0 && (
                      <div className="border-t border-zinc-700/40 pt-2">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1">Attachments</p>
                        <ul className="space-y-1">
                          {documentsByBookingId.get(booking.id)?.map((doc) => (
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
