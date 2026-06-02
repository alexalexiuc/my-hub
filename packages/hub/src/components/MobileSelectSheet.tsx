'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { XOutlineIcon } from '@/components/icons/XOutlineIcon';
import {
  applyDropdownFilter,
  buildDropdownFuse,
  type DropdownOption,
  type SelectCreateOption,
} from './searchableSelect.utils';

type MobileSelectSheetProps = {
  options: DropdownOption[];
  maxResults?: number;
  value?: string | number;
  onChange: (item: DropdownOption | null) => void;
  onClose: () => void;
  title?: string;
  placeholder?: string;
  searchable?: boolean;
  fuse?: boolean | { threshold: number };
  renderOption?: (item: DropdownOption) => React.ReactNode;
  noResultsText?: string;
  clearable?: boolean;
  clearAriaLabel?: string;
  createOption?: SelectCreateOption;
  /** When false, selecting an option does not close the sheet. Default: true. */
  closeOnChange?: boolean;
};

/**
 * Full-screen bottom sheet for picking a dropdown option on mobile.
 * Portals to document.body to render above all modal layers (z-[1100]).
 * Only ever rendered client-side (gated by isMobile && open in SearchableSelect).
 */
export function MobileSelectSheet({
  options,
  maxResults,
  value,
  onChange,
  onClose,
  title,
  placeholder = 'Search…',
  searchable = true,
  fuse,
  renderOption,
  noResultsText,
  clearable = false,
  clearAriaLabel = 'Clear selection',
  createOption,
  closeOnChange = true,
}: MobileSelectSheetProps) {
  const [query, setQuery] = useState('');
  const [vp, setVp] = useState(() => ({
    top: window.visualViewport?.offsetTop ?? 0,
    height: window.visualViewport?.height ?? window.innerHeight,
  }));
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchable) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [searchable]);

  // On iOS, opening the keyboard scrolls the layout viewport (window.scrollY > 0)
  // which visually offsets position:fixed elements upward. visualViewport.offsetTop
  // reflects that scroll so we can counteract it by pinning `top` to offsetTop.
  // visualViewport.height gives the visible area above the keyboard.
  useEffect(() => {
    const update = () => {
      const top = window.visualViewport?.offsetTop ?? 0;
      const height = window.visualViewport?.height ?? window.innerHeight;
      setVp(prev => (prev.top === top && prev.height === height ? prev : { top, height }));
    };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  // passive:false is required here to call preventDefault and block the modal behind from scrolling.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const block = (e: TouchEvent) => e.preventDefault();
    overlay.addEventListener('touchmove', block, { passive: false });
    return () => overlay.removeEventListener('touchmove', block);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const allow = (e: TouchEvent) => e.stopPropagation();
    list.addEventListener('touchmove', allow);
    return () => list.removeEventListener('touchmove', allow);
  }, []);

  const fuseInstance = useMemo(() => buildDropdownFuse(options, fuse), [options, fuse]);

  const trimmedQuery = query.trim();

  const results = useMemo(() => {
    const matches = applyDropdownFilter(options, trimmedQuery, searchable, fuseInstance);
    return typeof maxResults === 'number' ? matches.slice(0, maxResults) : matches;
  }, [options, trimmedQuery, searchable, fuseInstance, maxResults]);

  const showCreateOption = useMemo(() => {
    if (!createOption || !trimmedQuery) return false;
    if (createOption.shouldShow) return createOption.shouldShow(trimmedQuery, options);
    return !options.some(item => String(item.value).trim().toLowerCase() === trimmedQuery.toLowerCase());
  }, [createOption, trimmedQuery, options]);

  const selectedLabel = String(options.find(o => o.id === value)?.value ?? '');
  const canClear = clearable && value != null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-x-0 z-[1100] flex flex-col justify-end bg-black/60"
      style={{ top: vp.top, height: vp.height }}
      onClick={onClose}
    >
      <div
        className="slide-up-sheet flex h-full max-h-[calc(100%-24px)] flex-col rounded-t-[18px] border border-[var(--border)] bg-[var(--card)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
          <span className="text-sm font-semibold text-[var(--text)]">{title ?? placeholder}</span>
          <IconButton
            label="Close"
            icon={<XOutlineIcon className="size-3" />}
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-[var(--card2)] text-[var(--subtle)]"
          />
        </div>

        {searchable && (
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full text-[15px]"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        )}

        {selectedLabel && (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
            <span className="text-xs text-[var(--subtle)]">
              Selected: <span className="font-medium text-[var(--text)]">{selectedLabel}</span>
            </span>
            {canClear && (
              <Button
                type="button"
                variant="transparent"
                size="xs"
                aria-label={clearAriaLabel}
                onClick={() => {
                  onChange(null);
                  onClose();
                }}
                className="p-0 text-xs text-[var(--red)]"
              >
                Clear
              </Button>
            )}
          </div>
        )}

        <div ref={listRef} className="overflow-y-auto">
          {results.map(item => (
            <Button
              key={item.id}
              type="button"
              variant="transparent"
              size="xs"
              onClick={() => {
                onChange(item);
                if (closeOnChange) onClose();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-none border-b border-[var(--border)] px-4 py-3.5 text-left text-[14px] font-normal text-[var(--text)] active:bg-[var(--card3)]',
                value === item.id && 'bg-[var(--card2)] font-medium',
              )}
            >
              {renderOption ? renderOption(item) : <span>{String(item.value)}</span>}
            </Button>
          ))}

          {showCreateOption && createOption && (
            <Button
              type="button"
              variant="transparent"
              size="xs"
              onClick={() => {
                createOption.onCreate(trimmedQuery);
                onClose();
              }}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-none border-b border-[var(--border)] px-4 py-3.5 text-left text-[14px] font-normal text-[var(--accent)] active:bg-[var(--card3)]',
                createOption.className,
              )}
            >
              {createOption.renderLabel ? (
                createOption.renderLabel(trimmedQuery)
              ) : (
                <>
                  <span>+</span>
                  <span>{`Create "${trimmedQuery}"`}</span>
                </>
              )}
            </Button>
          )}

          {results.length === 0 && !showCreateOption && (
            <div className="px-4 py-6 text-center text-sm text-[var(--subtle)]">
              {trimmedQuery ? (noResultsText ?? 'No options found') : 'No options available'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
