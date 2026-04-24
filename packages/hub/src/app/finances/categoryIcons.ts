import { CategoryIcons } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';

/** Maps every CategoryIcon value to a display emoji. */
export const CATEGORY_ICON_EMOJI: Record<CategoryIcon, string> = {
  [CategoryIcons.ShoppingCart]: '🛒',
  [CategoryIcons.UtensilsCrossed]: '🍽',
  [CategoryIcons.Coffee]: '☕',
  [CategoryIcons.Car]: '🚗',
  [CategoryIcons.Bus]: '🚌',
  [CategoryIcons.Plane]: '✈️',
  [CategoryIcons.Motorbike]: '🏍',
  [CategoryIcons.Home]: '🏠',
  [CategoryIcons.Zap]: '⚡',
  [CategoryIcons.Wifi]: '📶',
  [CategoryIcons.Heart]: '❤️',
  [CategoryIcons.Pill]: '💊',
  [CategoryIcons.Tv]: '📺',
  [CategoryIcons.Music]: '🎵',
  [CategoryIcons.Gamepad2]: '🎮',
  [CategoryIcons.Banknote]: '💵',
  [CategoryIcons.TrendingUp]: '📈',
  [CategoryIcons.CreditCard]: '💳',
  [CategoryIcons.ShoppingBag]: '🛍',
  [CategoryIcons.Gift]: '🎁',
  [CategoryIcons.BookOpen]: '📖',
  [CategoryIcons.Briefcase]: '💼',
  [CategoryIcons.Tag]: '🏷',
  [CategoryIcons.MoreHorizontal]: '•••',
};

/** Returns the display emoji for a CategoryIcon key, or a fallback dot. */
export function categoryIconEmoji(icon: string | null | undefined): string {
  if (!icon) return '•';
  return (CATEGORY_ICON_EMOJI as Record<string, string>)[icon] ?? '•';
}
