'use client';

import { Fragment, useState } from 'react';
import type {
  AccommodationDetails,
  BookingDetails,
  FlightDetails,
  MealType,
  TransportDetails,
  TripDocument,
} from '@my-hub/shared/types';
import type { TripBookingExtended } from './types';
import { TravelTimeDisplay } from './TravelTimeDisplay';
import { isTransportBookingType } from '@my-hub/shared/utils';

type BookingExpandedPanelProps = {
  booking: TripBookingExtended;
  documents: TripDocument[];
};

function FlightDetailsPill({ booking }: { booking: TripBookingExtended }) {
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
}

function TransportDetailsPill({ booking }: { booking: TripBookingExtended }) {
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
}

function ExtraDetailsSection({ booking }: { booking: TripBookingExtended }) {
  const d = booking.details as BookingDetails | null;
  const entries = d?.extra ? Object.entries(d.extra) : [];
  if (entries.length === 0) return null;

  return (
    <div className="border-t border-zinc-700/40 pt-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1">Additional details</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {entries.map(([key, val]) => (
          <Fragment key={key}>
            <dt className="text-zinc-500 capitalize">{key}</dt>
            <dd className="text-zinc-300 truncate">{String(val)}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function MealTypeButton({ mealType }: { mealType: MealType }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Meal plan included"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm"
      >
        🍽
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-xs w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🍽</span>
              <h3 className="text-sm font-semibold text-zinc-100">{mealType.short}</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{mealType.description}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SourceTextSection({ booking }: { booking: TripBookingExtended }) {
  const d = booking.details as BookingDetails | null;
  if (!d?.rawText && !d?.source) return null;

  return (
    <div className="border-t border-zinc-700/40 pt-2 space-y-1">
      {d.source && (
        <p className="text-[11px] text-zinc-500">
          Source: <span className="text-zinc-400">{d.source}</span>
        </p>
      )}
      {d.rawText && (
        <details className="group">
          <summary className="text-[11px] uppercase tracking-wide text-zinc-500 cursor-pointer select-none list-none flex items-center gap-1">
            <span className="group-open:hidden">▸</span>
            <span className="hidden group-open:inline">▾</span>
            Source text
          </summary>
          <blockquote className="mt-1 text-xs text-zinc-400 italic leading-relaxed whitespace-pre-wrap">
            {d.rawText}
          </blockquote>
        </details>
      )}
    </div>
  );
}

export function BookingExpandedPanel({ booking, documents }: BookingExpandedPanelProps) {
  return (
    <div className="px-3 pb-3 pt-1 border-t border-zinc-700/50 space-y-2">
      {booking.bookingType === 'flight' && <FlightDetailsPill booking={booking} />}

      {isTransportBookingType(booking.bookingType) && <TransportDetailsPill booking={booking} />}

      {(booking.details as AccommodationDetails | null)?.kind === 'accommodation' &&
        (booking.details as AccommodationDetails).mealType && (
          <MealTypeButton mealType={(booking.details as AccommodationDetails).mealType!} />
        )}

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

      <ExtraDetailsSection booking={booking} />

      <SourceTextSection booking={booking} />

      {documents.length > 0 && (
        <div className="border-t border-zinc-700/40 pt-2">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1">Attachments</p>
          <ul className="space-y-1">
            {documents.map(doc => (
              <li key={doc.id} className="text-xs text-zinc-200">
                {doc.storagePath ? (
                  <a className="hover:underline text-amber-300" href={`/api/travel/documents/${doc.id}/download`}>
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
  );
}
