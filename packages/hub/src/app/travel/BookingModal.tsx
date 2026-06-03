'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal, Input, BookingTypeIcon } from '@/components';
import { TripBookingTypes, tripBookingTypeValues } from '@my-hub/shared/constants';
import { isTransportBookingType } from '@my-hub/shared/utils';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/utils';
import type { TripBookingExtended } from './types';
import {
  BookingFormSchema,
  type BookingFormValues,
  defaultBookingFormValues,
  bookingToFormValues,
  formToCreateBody,
  formToUpdateBody,
} from './booking-form.schema';
import { FieldCard, bookingTypeLabels } from './ui';
import { readActiveTripId } from './TripSwitcher';

type BookingModalProps = {
  editingBooking?: TripBookingExtended;
  onClose: () => void;
  onSaved: () => void;
};

export function BookingModal({ editingBooking, onClose, onSaved }: BookingModalProps) {
  const isEdit = !!editingBooking;

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(BookingFormSchema),
    defaultValues: editingBooking ? bookingToFormValues(editingBooking) : defaultBookingFormValues,
  });

  const bookingType = form.watch('bookingType');
  const isFlight = bookingType === TripBookingTypes.Flight;
  const isTransport = isTransportBookingType(bookingType);

  async function handleSubmit(values: BookingFormValues) {
    if (isEdit) {
      await apiFetch(`/api/travel/bookings/${editingBooking.id}`, {
        method: 'PATCH',
        body: formToUpdateBody(values),
      });
    } else {
      const tripId = readActiveTripId();
      if (!tripId) return;
      await apiFetch('/api/travel/bookings', {
        method: 'POST',
        body: formToCreateBody(values, tripId),
      });
    }
    onSaved();
  }

  return (
    <Modal
      title={isEdit ? 'Edit Reservation' : 'Add Reservation'}
      onClose={onClose}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={isEdit ? 'Save' : 'Add Reservation'}
      submitLoading={form.formState.isSubmitting}
      className="md:max-w-[560px]"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-2.5">
        <FieldCard label="Title *">
          <Input
            {...form.register('title')}
            placeholder="e.g. Tokyo — London BA0007"
            variant="ghost"
            autoFocus
            className="w-full text-[13px]"
          />
        </FieldCard>
        {form.formState.errors.title && (
          <p className="text-xs text-[var(--red)]">{form.formState.errors.title.message}</p>
        )}

        {/* Booking type — pill grid */}
        <Controller
          control={form.control}
          name="bookingType"
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--card2)] p-1.5">
              {tripBookingTypeValues.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => field.onChange(t)}
                  className={cn(
                    'flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11px] font-medium transition-colors',
                    field.value === t
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-transparent text-[var(--muted)] hover:text-[var(--text)]',
                  )}
                >
                  <BookingTypeIcon type={t} />
                  {bookingTypeLabels[t]}
                </button>
              ))}
            </div>
          )}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <FieldCard label="Provider">
            <Input
              {...form.register('provider')}
              placeholder="e.g. British Airways"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Reference link">
            <Input
              {...form.register('referenceLink')}
              type="url"
              placeholder="https://…"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <FieldCard label="Start">
            <Input {...form.register('startAt')} type="datetime-local" variant="ghost" className="w-full text-[13px]" />
          </FieldCard>
          <FieldCard label="End">
            <Input {...form.register('endAt')} type="datetime-local" variant="ghost" className="w-full text-[13px]" />
          </FieldCard>
        </div>

        {isFlight && (
          <div className="grid grid-cols-2 gap-2.5">
            <FieldCard label="Flight number">
              <Input
                {...form.register('flightNumber')}
                placeholder="e.g. BA2490"
                variant="ghost"
                className="w-full text-[13px] uppercase"
              />
            </FieldCard>
            <FieldCard label="Seat">
              <Input
                {...form.register('flightSeat')}
                placeholder="e.g. 14A"
                variant="ghost"
                className="w-full text-[13px]"
              />
            </FieldCard>
            <FieldCard label="From (IATA)">
              <Input
                {...form.register('flightOriginIata')}
                placeholder="LHR"
                maxLength={3}
                variant="ghost"
                className="w-full text-[13px] uppercase"
              />
            </FieldCard>
            <FieldCard label="To (IATA)">
              <Input
                {...form.register('flightDestIata')}
                placeholder="CDG"
                maxLength={3}
                variant="ghost"
                className="w-full text-[13px] uppercase"
              />
            </FieldCard>
            <FieldCard label="Terminal">
              <Input
                {...form.register('flightTerminal')}
                placeholder="optional"
                variant="ghost"
                className="w-full text-[13px]"
              />
            </FieldCard>
            <FieldCard label="Gate">
              <Input
                {...form.register('flightGate')}
                placeholder="optional"
                variant="ghost"
                className="w-full text-[13px]"
              />
            </FieldCard>
          </div>
        )}

        {isTransport && (
          <div className="grid grid-cols-2 gap-2.5">
            <FieldCard label="From">
              <Input
                {...form.register('transportOrigin')}
                placeholder="e.g. Paris Gare du Nord"
                variant="ghost"
                className="w-full text-[13px]"
              />
            </FieldCard>
            <FieldCard label="To">
              <Input
                {...form.register('transportDest')}
                placeholder="e.g. London St Pancras"
                variant="ghost"
                className="w-full text-[13px]"
              />
            </FieldCard>
            <div className="col-span-2">
              <FieldCard label="Service number">
                <Input
                  {...form.register('transportServiceNumber')}
                  placeholder="e.g. TGV 6201"
                  variant="ghost"
                  className="w-full text-[13px]"
                />
              </FieldCard>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <FieldCard label="Contact name">
            <Input
              {...form.register('contactName')}
              placeholder="optional"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Contact email">
            <Input
              {...form.register('contactEmail')}
              type="email"
              placeholder="optional"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
          <FieldCard label="Contact phone">
            <Input
              {...form.register('contactPhone')}
              type="tel"
              placeholder="optional"
              variant="ghost"
              className="w-full text-[13px]"
            />
          </FieldCard>
        </div>
      </form>
    </Modal>
  );
}
