import { z } from 'zod';
import { toDateInputValue } from '@my-hub/shared/utils';
import type { Trip } from '@my-hub/shared/types';

export const TripFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  destination: z.string(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color'),
  startAt: z.string(),
  endAt: z.string(),
});

export type TripFormValues = z.infer<typeof TripFormSchema>;

export function tripToFormValues(trip: Trip): TripFormValues {
  return {
    name: trip.name,
    destination: trip.destination ?? '',
    color: trip.color,
    startAt: toDateInputValue(trip.startAt),
    endAt: toDateInputValue(trip.endAt),
  };
}

export function formToCreateBody(values: TripFormValues): Record<string, unknown> {
  return {
    name: values.name,
    color: values.color,
    destination: values.destination.trim() || null,
    startAt: values.startAt ? `${values.startAt}T00:00:00.000Z` : undefined,
    endAt: values.endAt ? `${values.endAt}T00:00:00.000Z` : undefined,
  };
}

export function formToUpdateBody(values: TripFormValues): Record<string, unknown> {
  return {
    name: values.name,
    destination: values.destination.trim() || null,
    color: values.color,
    startAt: values.startAt ? `${values.startAt}T00:00:00.000Z` : null,
    endAt: values.endAt ? `${values.endAt}T00:00:00.000Z` : null,
  };
}
