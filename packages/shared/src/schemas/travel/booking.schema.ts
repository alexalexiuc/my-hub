/**
 * API-level Zod schemas for trip booking endpoints.
 * Use these in Next.js route handlers to validate request bodies.
 * The output type matches what the service layer expects (camelCase, parsed numbers).
 */
import { z } from 'zod';
import { TripBookingTypes } from '../../constants/travel.js';

export const BookingCreateSchema = z.object({
  tripId: z.number().int().positive(),
  title: z
    .string()
    .min(1, 'title is required')
    .transform(s => s.trim()),
  bookingType: z.nativeEnum(TripBookingTypes).optional(),
  provider: z.string().optional(),
  confirmationNumber: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  status: z.string().optional(),
  costAmount: z.number().optional(),
  costCurrency: z.string().optional(),
  location: z.string().optional(),
  referenceLink: z.string().optional(),
  notes: z.string().optional(),
  flightDetails: z.record(z.unknown()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;

export const BookingUpdateSchema = z.object({
  title: z
    .string()
    .min(1)
    .transform(s => s.trim())
    .optional(),
  bookingType: z.nativeEnum(TripBookingTypes).optional(),
  provider: z.string().optional(),
  referenceLink: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  flightDetails: z.record(z.unknown()).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

export type BookingUpdateInput = z.infer<typeof BookingUpdateSchema>;
