/**
 * API-level Zod schemas for trip booking endpoints.
 * Use these in Next.js route handlers to validate request bodies.
 * The output type matches what the service layer expects (snake_case, parsed numbers).
 */
import { z } from 'zod';
import { tripBookingTypeValues } from '../../constants/travel.js';

export const BookingCreateSchema = z.object({
  trip_id: z.number().int().positive(),
  title: z
    .string()
    .min(1, 'title is required')
    .transform((s) => s.trim()),
  booking_type: z.enum(tripBookingTypeValues as [string, ...string[]]).optional(),
  provider: z.string().optional(),
  confirmation_number: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  status: z.string().optional(),
  cost_amount: z.number().optional(),
  cost_currency: z.string().optional(),
  location: z.string().optional(),
  reference_link: z.string().optional(),
  notes: z.string().optional(),
  flight_details: z.record(z.unknown()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;

export const BookingUpdateSchema = z.object({
  title: z
    .string()
    .min(1)
    .transform((s) => s.trim())
    .optional(),
  booking_type: z.enum(tripBookingTypeValues as [string, ...string[]]).optional(),
  provider: z.string().optional(),
  reference_link: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  flight_details: z.record(z.unknown()).optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
});

export type BookingUpdateInput = z.infer<typeof BookingUpdateSchema>;
