import type { TripBookingType } from '@my-hub/shared/types';
import {
  PlaneIcon,
  BuildingIcon,
  CarKeyIcon,
  TrainIcon,
  BusIcon,
  BoatIcon,
  CarIcon,
  UtensilsIcon,
  MapFlagIcon,
  TicketIcon,
  CalendarIcon,
} from '@/components/icons';

const iconMap: Record<TripBookingType, () => React.JSX.Element> = {
  flight: PlaneIcon,
  accommodation: BuildingIcon,
  rental_car: CarKeyIcon,
  train: TrainIcon,
  bus: BusIcon,
  ferry: BoatIcon,
  taxi: CarIcon,
  restaurant: UtensilsIcon,
  tour: MapFlagIcon,
  activity: TicketIcon,
  ticket: TicketIcon,
  other: CalendarIcon,
};

export function BookingTypeIcon({ type }: { type: TripBookingType }) {
  const Icon = iconMap[type] ?? CalendarIcon;
  return <Icon />;
}
