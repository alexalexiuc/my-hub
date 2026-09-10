import { THEME_SWATCHES } from '@/lib/theme-swatches.generated';
import { cn } from '@/lib/utils';
import type { ThemeKey } from '@my-hub/shared/constants';

export type ThemeSwatchProps = {
  themeKey: ThemeKey;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-11 w-11' };
const RING_WIDTH = { sm: 2, md: 3, lg: 4 };

/** A round two-tone chip: the theme's background ringed by its accent. */
export function ThemeSwatch({ themeKey, size = 'md', className }: ThemeSwatchProps) {
  const { accent, bg } = THEME_SWATCHES[themeKey] ?? { accent: '#6366f1', bg: '#09090b' };
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 rounded-full', SIZES[size], className)}
      style={{ backgroundColor: bg, boxShadow: `inset 0 0 0 ${RING_WIDTH[size]}px ${accent}` }}
    />
  );
}
