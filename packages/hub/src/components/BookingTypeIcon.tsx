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

const iconMap: Record<string, () => React.JSX.Element> = {
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

export function BookingTypeIcon({ type }: { type: string }) {
  const Icon = iconMap[type] ?? CalendarIcon;
  return <Icon />;
}
