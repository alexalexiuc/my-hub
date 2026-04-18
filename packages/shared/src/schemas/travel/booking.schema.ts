/**
 * API-level Zod schemas for trip booking endpoints.
 * Use these in Next.js route handlers to validate request bodies.
 * The output type matches what the service layer expects (camelCase, parsed numbers).
 */
import { z } from 'zod';
import { TripBookingTypes } from '../../constants/travel.js';

export const BookingCreateSchema = z.object({
  tripId: z.number().int().positive(),
  title: z.string().trim().min(1, 'title is required'),
  bookingType: z.enum(TripBookingTypes).optional(),
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
  flightDetails: z.record(z.string(), z.unknown()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;

export const BookingUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  bookingType: z.enum(TripBookingTypes).optional(),
  provider: z.string().nullable().optional(),
  referenceLink: z.string().nullable().optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  flightDetails: z.record(z.string(), z.unknown()).optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
});

export type BookingUpdateInput = z.infer<typeof BookingUpdateSchema>;
