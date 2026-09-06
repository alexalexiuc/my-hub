'use client';

import { themeClassName, type ThemeScope } from '@my-hub/shared/constants';
import { cn } from '@/lib/utils';
import { useThemes } from './ThemeProvider';

export type FeatureThemeProps = {
  /** Which themed feature scope this subtree belongs to ('travel' | 'finances' | 'calories'). */
  feature: ThemeScope;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wraps a feature subtree with its resolved theme class and a stable `data-feature` attribute.
 * Replaces the old literal `travel-theme` / `finances-theme` / `calories-theme` classes so the
 * active theme class can vary per user while `usePortalTheme` (which matches any `*-theme`
 * class) and the `[data-feature='finances']` CSS rule keep working unchanged.
 */
export function FeatureTheme({ feature, className, children }: FeatureThemeProps) {
  const { resolvedFor } = useThemes();

  return (
    <div data-feature={feature} className={cn(themeClassName(resolvedFor(feature)), className)}>
      {children}
    </div>
  );
}
