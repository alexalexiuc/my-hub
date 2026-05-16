'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Input } from '@/components';
import {
  applyDropdownFilter,
  buildDropdownFuse,
  type DropdownOption,
  type FinancialDropdownCreateOption,
} from './financialDropdown.utils';

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
  createOption?: FinancialDropdownCreateOption;
};

/**
 * Full-screen bottom sheet for picking a dropdown option on mobile.
 * Portals to document.body to render above all modal layers (z-[1100]).
 * Only ever rendered client-side (gated by isMobile && open in FinancialDropdown).
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
}: MobileSelectSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchable) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [searchable]);

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
    <div className="finances-theme fixed inset-x-0 top-0 h-[100dvh] z-[1100] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="fin-slide-up flex max-h-[80dvh] flex-col rounded-t-[18px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--fin-border)] px-4 py-3.5">
          <span className="text-sm font-semibold text-[var(--fin-text)]">{title ?? placeholder}</span>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--fin-card2)] text-xs text-[var(--fin-subtle)]"
          >
            ✕
          </button>
        </div>

        {searchable && (
          <div className="shrink-0 border-b border-[var(--fin-border)] px-4 py-2.5">
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
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--fin-border)] px-4 py-2">
            <span className="text-xs text-[var(--fin-subtle)]">
              Selected: <span className="font-medium text-[var(--fin-text)]">{selectedLabel}</span>
            </span>
            {canClear && (
              <button
                type="button"
                aria-label={clearAriaLabel}
                onClick={() => {
                  onChange(null);
                  onClose();
                }}
                className="text-xs text-[var(--fin-red)]"
              >
                Clear
              </button>
            )}
          </div>
        )}

        <div className="overflow-y-auto">
          {results.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item);
                onClose();
              }}
              className={cn(
                'flex w-full items-center gap-2 border-b border-[var(--fin-border)] bg-transparent px-4 py-3.5 text-left text-[14px] text-[var(--fin-text)] active:bg-[var(--fin-card3)]',
                value === item.id && 'bg-[var(--fin-card2)] font-medium',
              )}
            >
              {renderOption ? renderOption(item) : <span>{String(item.value)}</span>}
            </button>
          ))}

          {showCreateOption && createOption && (
            <button
              type="button"
              onClick={() => {
                createOption.onCreate(trimmedQuery);
                onClose();
              }}
              className={cn(
                'flex w-full items-center gap-1.5 border-b border-[var(--fin-border)] bg-transparent px-4 py-3.5 text-left text-[14px] text-[var(--fin-accent)] active:bg-[var(--fin-card3)]',
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
            </button>
          )}

          {results.length === 0 && !showCreateOption && (
            <div className="px-4 py-6 text-center text-sm text-[var(--fin-subtle)]">
              {trimmedQuery ? (noResultsText ?? 'No options found') : 'No options available'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
