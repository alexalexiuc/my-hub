'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookingTypeIcon, Button, Input, Select } from '@/components';
import { TripBookingTypes, tripBookingTypeValues } from '@my-hub/shared/constants';
import type { TripBookingType } from '@my-hub/shared/types';
import { isTransportBookingType } from '@my-hub/shared/utils';
import { BookingFormSchema, type BookingFormValues, defaultBookingFormValues } from './booking-form.schema';

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

type BookingFormProps = {
  defaultValues?: Partial<BookingFormValues>;
  onSubmit: (values: BookingFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
};

export function BookingForm({ defaultValues, onSubmit, onCancel, submitLabel, disabled }: BookingFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(BookingFormSchema),
    defaultValues: { ...defaultBookingFormValues, ...defaultValues },
  });

  const bookingType = watch('bookingType');

  async function handleFormSubmit(values: BookingFormValues) {
    await onSubmit(values);
    reset();
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-2">
      <Input {...register('title')} placeholder="Reservation title" />
      {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">
            <BookingTypeIcon type={bookingType} />
          </span>
          <Select
            {...register('bookingType')}
            options={tripBookingTypeValues.map(type => ({ value: type, label: bookingTypeLabels[type] }))}
          />
        </div>
        <Input {...register('provider')} placeholder="Provider" />
      </div>

      <Input type="url" {...register('referenceLink')} placeholder="Reference link (e.g. https://booking.com/...)" />
      <Input type="datetime-local" {...register('startAt')} />
      <Input type="datetime-local" {...register('endAt')} />

      {bookingType === TripBookingTypes.Flight && (
        <div className="grid grid-cols-2 gap-2">
          <Input {...register('flightNumber')} placeholder="Flight no. (e.g. BA2490)" />
          <Input {...register('flightSeat')} placeholder="Seat (e.g. 14A)" />
          <Input
            {...register('flightOriginIata')}
            placeholder="From IATA (e.g. LHR)"
            maxLength={3}
            className="uppercase"
          />
          <Input {...register('flightDestIata')} placeholder="To IATA (e.g. CDG)" maxLength={3} className="uppercase" />
          <Input {...register('flightTerminal')} placeholder="Terminal" />
          <Input {...register('flightGate')} placeholder="Gate" />
        </div>
      )}

      {isTransportBookingType(bookingType) && (
        <div className="grid grid-cols-2 gap-2">
          <Input {...register('transportOrigin')} placeholder="From (e.g. Paris Gare du Nord)" />
          <Input {...register('transportDest')} placeholder="To (e.g. London St Pancras)" />
          <Input
            {...register('transportServiceNumber')}
            placeholder="Service no. (e.g. TGV 6201)"
            className="col-span-2"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Input {...register('contactName')} placeholder="Contact name" />
        <Input type="email" {...register('contactEmail')} placeholder="Contact email" />
        <Input type="tel" {...register('contactPhone')} placeholder="Contact phone" />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" size="xs" loading={isSubmitting} disabled={disabled || isSubmitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
