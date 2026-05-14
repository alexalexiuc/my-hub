'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Fuse from 'fuse.js';
import { cn } from '@/lib/utils';
import { Input } from '@/components';
import type { DropdownOption, FinancialDropdownCreateOption } from './FinancialDropdown';

type MobileSelectSheetProps = {
  options: DropdownOption[];
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
 * Portals to document.body so it renders above all modal layers.
 */
export function MobileSelectSheet({
  options,
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
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (mounted && searchable) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [mounted, searchable]);

  const fuseInstance = useMemo(() => {
    if (!fuse || options.length === 0) return null;
    const threshold = typeof fuse === 'object' ? fuse.threshold : 0.35;
    return new Fuse(options, { keys: ['value'], threshold });
  }, [fuse, options]);

  const trimmedQuery = query.trim();

  const results = useMemo(() => {
    if (!searchable || !trimmedQuery) return options;
    if (fuseInstance) return fuseInstance.search(trimmedQuery).map(r => r.item);
    const lowered = trimmedQuery.toLowerCase();
    return options.filter(item => String(item.value).toLowerCase().includes(lowered));
  }, [searchable, trimmedQuery, options, fuseInstance]);

  const showCreateOption = useMemo(() => {
    if (!createOption || !trimmedQuery) return false;
    if (createOption.shouldShow) return createOption.shouldShow(trimmedQuery, options);
    return !options.some(item => String(item.value).trim().toLowerCase() === trimmedQuery.toLowerCase());
  }, [createOption, trimmedQuery, options]);

  const selectedLabel = String(options.find(o => o.id === value)?.value ?? '');
  const canClear = clearable && value != null;

  if (!mounted) return null;

  const content = (
    <div className="finances-theme fixed inset-0 z-[1100] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[80vh] flex-col rounded-t-[18px] border border-[var(--fin-border)] bg-[var(--fin-card)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--fin-border)] px-4 py-3.5">
          <span className="text-sm font-semibold text-[var(--fin-text)]">{title ?? placeholder}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--fin-card2)] text-xs text-[var(--fin-subtle)]"
          >
            ✕
          </button>
        </div>

        {/* Search input */}
        {searchable && (
          <div className="shrink-0 border-b border-[var(--fin-border)] px-4 py-2.5">
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full text-[15px]"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        )}

        {/* Selected indicator + clear */}
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

        {/* Options list */}
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
                  <span>Create &quot;{trimmedQuery}&quot;</span>
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
    </div>
  );

  return createPortal(content, document.body);
}
