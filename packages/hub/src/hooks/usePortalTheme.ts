import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Returns [anchorRef, themeClassName]. Attach `anchorRef` to an in-tree (non-portaled)
 * element; the hook climbs the DOM to the nearest `*-theme` ancestor and returns its
 * class so it can be re-applied on a portal root — restoring the CSS custom properties
 * (--card, --overlay, etc.) that are scoped to the theme wrapper and otherwise absent
 * in document.body portals.
 */
export function usePortalTheme(): [React.RefObject<HTMLSpanElement>, string] {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [themeClassName, setThemeClassName] = useState('');

  useLayoutEffect(() => {
    const themed = anchorRef.current?.closest<HTMLElement>('[class*="-theme"]');
    const themeClass = themed?.className.match(/\b\S+-theme\b/)?.[0];
    if (themeClass) setThemeClassName(themeClass);
  }, []);

  return [anchorRef, themeClassName];
}
