'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { cn } from '@/lib/utils';
import { Input } from '@/components';

export type DropdownOption = {
  id: number | string;
  value: number | string;
};

type FinancialDropdownCreateOption = {
  onCreate: (query: string) => void;
  shouldShow?: (query: string, options: DropdownOption[]) => boolean;
  renderLabel?: (query: string) => React.ReactNode;
  className?: string;
};

export type FinancialDropdownProps = {
  options: DropdownOption[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (item: DropdownOption) => void;
  renderOption?: (item: DropdownOption) => React.ReactNode;
  placeholder?: string;
  noResultsText?: string;
  maxResults?: number;
  closeOnSelect?: boolean;
  /** Enable fuzzy search on the option value. Pass `true` for defaults or `{ threshold }` to tune. */
  fuse?: boolean | { threshold: number };
  /** When false, renders a clickable label instead of an input — no filtering, shows all options. Defaults to true. */
  searchable?: boolean;
  createOption?: FinancialDropdownCreateOption;
  clearable?: boolean;
  onClear?: () => void;
  clearAriaLabel?: string;
  inputClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  inputProps?: Omit<React.ComponentPropsWithoutRef<'input'>, 'value' | 'placeholder'>;
};

export function FinancialDropdown({
  options,
  query,
  onQueryChange,
  onSelect,
  renderOption,
  placeholder,
  noResultsText,
  maxResults,
  closeOnSelect = true,
  fuse,
  searchable = true,
  createOption,
  clearable = false,
  onClear,
  clearAriaLabel = 'Clear selection',
  inputClassName,
  menuClassName,
  optionClassName,
  inputProps,
}: FinancialDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fuseInstance = useMemo(() => {
    if (!fuse || options.length === 0) return null;
    const threshold = typeof fuse === 'object' ? fuse.threshold : 0.35;
    return new Fuse(options, { keys: ['value'], threshold });
  }, [fuse, options]);

  const trimmedQuery = query.trim();

  const results = useMemo(() => {
    let matches: DropdownOption[];

    if (!searchable || !trimmedQuery) {
      matches = options;
    } else if (fuseInstance) {
      matches = fuseInstance.search(trimmedQuery).map(result => result.item);
    } else {
      const lowered = trimmedQuery.toLowerCase();
      matches = options.filter(item => String(item.value).toLowerCase().includes(lowered));
    }

    return typeof maxResults === 'number' ? matches.slice(0, maxResults) : matches;
  }, [searchable, trimmedQuery, options, fuseInstance, maxResults]);

  const showCreateOption = useMemo(() => {
    if (!createOption) return false;
    if (createOption.shouldShow) {
      return createOption.shouldShow(trimmedQuery, options);
    }
    if (!trimmedQuery) return false;

    return !options.some(item => String(item.value).trim().toLowerCase() === trimmedQuery.toLowerCase());
  }, [createOption, trimmedQuery, options]);

  const canClear = clearable && trimmedQuery.length > 0;

  useEffect(() => {
    function handlePointerOutside(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        {searchable ? (
          <Input
            {...inputProps}
            value={query}
            onChange={event => {
              inputProps?.onChange?.(event);
              onQueryChange(event.target.value);
            }}
            onFocus={event => {
              inputProps?.onFocus?.(event);
              setOpen(true);
            }}
            autoComplete={inputProps?.autoComplete ?? 'off'}
            autoCorrect={inputProps?.autoCorrect ?? 'off'}
            autoCapitalize={inputProps?.autoCapitalize ?? 'none'}
            spellCheck={inputProps?.spellCheck ?? false}
            placeholder={placeholder}
            variant="ghost"
            className={cn('w-full text-[15px]', canClear && 'pr-7', inputClassName)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(prev => !prev)}
            className={cn(
              'flex w-full cursor-pointer items-center justify-between gap-1 bg-transparent text-left',
              canClear && 'pr-7',
              inputClassName,
            )}
          >
            <span className="truncate">{query || <span className="text-[var(--fin-subtle)]">{placeholder}</span>}</span>
            <svg
              className="ml-1 shrink-0 text-[var(--fin-subtle)]"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
            >
              <path
                d="M1 3l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {canClear && (
          <button
            type="button"
            aria-label={clearAriaLabel}
            title={clearAriaLabel}
            onMouseDown={event => {
              event.preventDefault();
              if (onClear) {
                onClear();
              } else {
                onQueryChange('');
              }
              setOpen(false);
            }}
            className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[14px] text-[var(--fin-red)] hover:bg-[var(--fin-red-d)]"
          >
            X
          </button>
        )}
      </div>

      {open && (results.length > 0 || showCreateOption || (trimmedQuery.length > 0 && noResultsText)) && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-20 mt-1 max-h-[200px] overflow-y-auto rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] shadow-lg',
            menuClassName,
          )}
        >
          {results.map(item => (
            <button
              key={item.id}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                onSelect(item);
                if (closeOnSelect) {
                  setOpen(false);
                }
              }}
              className={cn(
                'flex w-full items-center gap-2 border-none bg-transparent px-3 py-[8px] text-left text-[13px] text-[var(--fin-text)] hover:bg-[var(--fin-card3)]',
                optionClassName,
              )}
            >
              {renderOption ? renderOption(item) : <span>{String(item.value)}</span>}
            </button>
          ))}

          {results.length === 0 && trimmedQuery.length > 0 && noResultsText && (
            <div className="px-3 py-[8px] text-[12px] text-[var(--fin-subtle)]">{noResultsText}</div>
          )}

          {showCreateOption && createOption && (
            <button
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                createOption.onCreate(trimmedQuery);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-1.5 border-none bg-transparent px-3 py-[8px] text-left text-[13px] text-[var(--fin-accent)] hover:bg-[var(--fin-card3)]',
                createOption.className,
              )}
            >
              {createOption.renderLabel ? (
                createOption.renderLabel(trimmedQuery)
              ) : (
                <>
                  <span>+</span>
                  <span>Create "{trimmedQuery}"</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
