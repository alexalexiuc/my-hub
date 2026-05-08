import { CategoryIcons } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';

export const ICON_OPTIONS: { value: CategoryIcon; emoji: string; label: string }[] = [
  { value: CategoryIcons.ShoppingCart, emoji: '🛒', label: 'Groceries' },
  { value: CategoryIcons.UtensilsCrossed, emoji: '🍽️', label: 'Dining' },
  { value: CategoryIcons.Coffee, emoji: '☕', label: 'Coffee' },
  { value: CategoryIcons.Car, emoji: '🚗', label: 'Car' },
  { value: CategoryIcons.Bus, emoji: '🚌', label: 'Transit' },
  { value: CategoryIcons.Plane, emoji: '✈️', label: 'Travel' },
  { value: CategoryIcons.Motorbike, emoji: '🏍', label: 'Motorbike' },
  { value: CategoryIcons.Home, emoji: '🏠', label: 'Home' },
  { value: CategoryIcons.Zap, emoji: '⚡', label: 'Utilities' },
  { value: CategoryIcons.Wifi, emoji: '📶', label: 'Internet' },
  { value: CategoryIcons.Heart, emoji: '❤️', label: 'Health' },
  { value: CategoryIcons.Pill, emoji: '💊', label: 'Pharmacy' },
  { value: CategoryIcons.Tv, emoji: '📺', label: 'TV' },
  { value: CategoryIcons.Music, emoji: '🎵', label: 'Music' },
  { value: CategoryIcons.Gamepad2, emoji: '🎮', label: 'Gaming' },
  { value: CategoryIcons.Banknote, emoji: '💵', label: 'Cash' },
  { value: CategoryIcons.TrendingUp, emoji: '📈', label: 'Invest' },
  { value: CategoryIcons.CreditCard, emoji: '💳', label: 'Card' },
  { value: CategoryIcons.ShoppingBag, emoji: '🛍', label: 'Shopping' },
  { value: CategoryIcons.Gift, emoji: '🎁', label: 'Gifts' },
  { value: CategoryIcons.BookOpen, emoji: '📖', label: 'Education' },
  { value: CategoryIcons.Briefcase, emoji: '💼', label: 'Work' },
  { value: CategoryIcons.Dumbbell, emoji: '🏋️', label: 'Gym' },
  { value: CategoryIcons.PawPrint, emoji: '🐾', label: 'Pets' },
  { value: CategoryIcons.Baby, emoji: '👶', label: 'Baby' },
  { value: CategoryIcons.Scissors, emoji: '✂️', label: 'Personal Care' },
  { value: CategoryIcons.Receipt, emoji: '🧾', label: 'Subscriptions' },
  { value: CategoryIcons.Fuel, emoji: '⛽', label: 'Fuel' },
  { value: CategoryIcons.Shield, emoji: '🛡️', label: 'Insurance' },
  { value: CategoryIcons.Landmark, emoji: '🏛️', label: 'Taxes' },
  { value: CategoryIcons.MoreHorizontal, emoji: '•••', label: 'Misc' },
  { value: CategoryIcons.Drama, emoji: '🎭', label: 'Entertainment' },
  { value: CategoryIcons.HelpCircle, emoji: '⁉️', label: 'Unknown' },
  { value: CategoryIcons.Pants, emoji: '👖', label: 'Pants' },
  { value: CategoryIcons.SquareParking, emoji: '🅿️', label: 'Parking' },
  { value: CategoryIcons.Truck, emoji: '🚙', label: 'SUV' },
  { value: CategoryIcons.Sparkles, emoji: '🧹', label: 'Cleaning' },
  { value: CategoryIcons.Backpack, emoji: '🎒', label: 'School' },
  { value: CategoryIcons.Laptop, emoji: '💻', label: 'Laptop' },
  { value: CategoryIcons.Bot, emoji: '🤖', label: 'AI / Tech' },
  { value: CategoryIcons.Smartphone, emoji: '📱', label: 'Phone' },
  { value: CategoryIcons.Palmtree, emoji: '🏝️', label: 'Vacation' },
  { value: CategoryIcons.Euro, emoji: '💶', label: 'Euro' },
  { value: CategoryIcons.Building2, emoji: '🏦', label: 'Bank' },
  { value: CategoryIcons.Coins, emoji: '🪙', label: 'Coins' },
  { value: CategoryIcons.Wine, emoji: '🍷', label: 'Drinks' },
  { value: CategoryIcons.Hospital, emoji: '🏥', label: 'Medical' },
  { value: CategoryIcons.Tag, emoji: '🏷', label: 'Other' },
];

/** Maps every CategoryIcon value to a display emoji. */
export const CATEGORY_ICON_EMOJI: Record<CategoryIcon, string> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.value, o.emoji]),
) as Record<CategoryIcon, string>;

/** Returns the display emoji for a CategoryIcon key, or a fallback dot. */
export function categoryIconEmoji(icon: string | null | undefined): string {
  if (!icon) return '•';
  return (CATEGORY_ICON_EMOJI as Record<string, string>)[icon] ?? '•';
}
