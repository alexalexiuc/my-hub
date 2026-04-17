import { z } from 'zod';
import { TripBookingTypes, tripBookingTypeValues } from '@my-hub/shared/constants';
import type { FlightDetails, TripBookingType, TransportDetails } from '@my-hub/shared/types';
import { isTransportBookingType, toDateTimeLocalValue } from '@my-hub/shared/utils';
import type { TripBookingExtended } from './types';

export const BookingFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  bookingType: z.enum(tripBookingTypeValues as [TripBookingType, ...TripBookingType[]]),
  provider: z.string(),
  referenceLink: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  flightNumber: z.string(),
  flightSeat: z.string(),
  flightOriginIata: z.string().max(3),
  flightDestIata: z.string().max(3),
  flightTerminal: z.string(),
  flightGate: z.string(),
  transportOrigin: z.string(),
  transportDest: z.string(),
  transportServiceNumber: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
});

export type BookingFormValues = z.infer<typeof BookingFormSchema>;

export const defaultBookingFormValues: BookingFormValues = {
  title: '',
  bookingType: TripBookingTypes.Other,
  provider: '',
  referenceLink: '',
  startAt: '',
  endAt: '',
  flightNumber: '',
  flightSeat: '',
  flightOriginIata: '',
  flightDestIata: '',
  flightTerminal: '',
  flightGate: '',
  transportOrigin: '',
  transportDest: '',
  transportServiceNumber: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
};

export function bookingToFormValues(booking: TripBookingExtended): BookingFormValues {
  const d = (booking.details ?? {}) as { kind?: string };
  let flightNumber = '',
    flightSeat = '',
    flightOriginIata = '',
    flightDestIata = '',
    flightTerminal = '',
    flightGate = '';
  let transportOrigin = '',
    transportDest = '',
    transportServiceNumber = '';

  if (d.kind === 'flight' || booking.bookingType === TripBookingTypes.Flight) {
    const fd = booking.details as FlightDetails;
    flightNumber = fd.flightNumber ?? '';
    flightSeat = fd.seat ?? '';
    flightOriginIata = fd.originIata ?? '';
    flightDestIata = fd.destinationIata ?? '';
    flightTerminal = fd.terminal ?? '';
    flightGate = fd.gate ?? '';
  } else if (d.kind === 'transport') {
    const td = booking.details as TransportDetails;
    transportOrigin = td.origin.name;
    transportDest = td.destination.name;
    transportServiceNumber = td.serviceNumber ?? '';
  }

  return {
    title: booking.title,
    bookingType: booking.bookingType as TripBookingType,
    provider: booking.provider ?? '',
    referenceLink: booking.referenceLink ?? '',
    startAt: toDateTimeLocalValue(booking.startAt),
    endAt: toDateTimeLocalValue(booking.endAt),
    flightNumber,
    flightSeat,
    flightOriginIata,
    flightDestIata,
    flightTerminal,
    flightGate,
    transportOrigin,
    transportDest,
    transportServiceNumber,
    contactName: booking.contactName ?? '',
    contactEmail: booking.contactEmail ?? '',
    contactPhone: booking.contactPhone ?? '',
  };
}

export function formToCreateBody(values: BookingFormValues, tripId: number): Record<string, unknown> {
  const body: Record<string, unknown> = {
    tripId,
    title: values.title,
    bookingType: values.bookingType,
    provider: values.provider.trim() || undefined,
    referenceLink: values.referenceLink.trim() || undefined,
    startAt: values.startAt ? new Date(values.startAt).toISOString() : undefined,
    endAt: values.endAt ? new Date(values.endAt).toISOString() : undefined,
  };
  _appendDetailsFields(body, values);
  if (values.contactName.trim()) body.contactName = values.contactName.trim();
  if (values.contactEmail.trim()) body.contactEmail = values.contactEmail.trim();
  if (values.contactPhone.trim()) body.contactPhone = values.contactPhone.trim();
  return body;
}

export function formToUpdateBody(values: BookingFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: values.title,
    bookingType: values.bookingType,
    provider: values.provider.trim() || null,
    referenceLink: values.referenceLink.trim() || null,
    startAt: values.startAt ? new Date(values.startAt).toISOString() : null,
    endAt: values.endAt ? new Date(values.endAt).toISOString() : null,
    contactName: values.contactName.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
  };
  _appendDetailsFields(body, values);
  return body;
}

function _appendDetailsFields(body: Record<string, unknown>, values: BookingFormValues): void {
  if (values.bookingType === TripBookingTypes.Flight) {
    body.flightDetails = {
      kind: 'flight',
      ...(values.flightNumber.trim() && { flightNumber: values.flightNumber.trim() }),
      ...(values.flightSeat.trim() && { seat: values.flightSeat.trim() }),
      ...(values.flightOriginIata.trim() && { originIata: values.flightOriginIata.trim().toUpperCase() }),
      ...(values.flightDestIata.trim() && { destinationIata: values.flightDestIata.trim().toUpperCase() }),
      ...(values.flightTerminal.trim() && { terminal: values.flightTerminal.trim() }),
      ...(values.flightGate.trim() && { gate: values.flightGate.trim() }),
    };
  } else if (
    isTransportBookingType(values.bookingType) &&
    (values.transportOrigin.trim() || values.transportDest.trim())
  ) {
    body.flightDetails = {
      kind: 'transport',
      origin: { name: values.transportOrigin.trim() || '' },
      destination: { name: values.transportDest.trim() || '' },
      ...(values.transportServiceNumber.trim() && { serviceNumber: values.transportServiceNumber.trim() }),
    };
    if (!body.location && values.transportOrigin.trim() && values.transportDest.trim()) {
      body.location = `${values.transportOrigin.trim()} → ${values.transportDest.trim()}`;
    }
  }
}
