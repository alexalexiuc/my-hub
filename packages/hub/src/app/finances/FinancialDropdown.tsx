'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components';
import { ChevronDownOutlineIcon, XOutlineIcon } from '@/components/icons';
import { MobileSelectSheet } from './MobileSelectSheet';
import {
  applyDropdownFilter,
  buildDropdownFuse,
  type DropdownOption,
  type FinancialDropdownCreateOption,
} from './financialDropdown.utils';

// Re-export so existing consumers can keep importing from this file.
export type { DropdownOption, FinancialDropdownCreateOption } from './financialDropdown.utils';
export { buildDropdownFuse, applyDropdownFilter } from './financialDropdown.utils';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

type FinancialDropdownBaseProps = {
  options: DropdownOption[];
  /** ID of the selected option. The display label is derived from `options`. */
  value?: string | number;
  onChange: (item: DropdownOption | null) => void;
  renderOption?: (item: DropdownOption) => React.ReactNode;
  placeholder?: string;
  noResultsText?: string;
  maxResults?: number;
  closeOnChange?: boolean;
  createOption?: FinancialDropdownCreateOption;
  clearable?: boolean;
  clearAriaLabel?: string;
  inputClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
};

type FinancialDropdownSearchableProps = FinancialDropdownBaseProps & {
  searchable?: true;
  /** Enable fuzzy search on the option value. Pass `true` for defaults or `{ threshold }` to tune. */
  fuse?: boolean | { threshold: number };
  inputProps?: Omit<React.ComponentPropsWithoutRef<'input'>, 'value' | 'placeholder' | 'onChange'>;
};

type FinancialDropdownNonSearchableProps = FinancialDropdownBaseProps & {
  /** When false, renders a clickable label instead of an input — no filtering, shows all options. */
  searchable: false;
  fuse?: never;
  inputProps?: never;
};

export type FinancialDropdownProps = FinancialDropdownSearchableProps | FinancialDropdownNonSearchableProps;

export function FinancialDropdown({
  options,
  value,
  onChange,
  renderOption,
  placeholder,
  noResultsText,
  maxResults,
  closeOnChange = true,
  fuse,
  searchable = true,
  createOption,
  clearable = false,
  clearAriaLabel = 'Clear selection',
  inputClassName,
  menuClassName,
  optionClassName,
  inputProps,
}: FinancialDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const selectedLabel = String(options.find(o => o.id === value)?.value ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const displayValue = open ? searchQuery : selectedLabel;
  const inputPlaceholder = open && selectedLabel ? selectedLabel : placeholder;

  function closeDropdown() {
    setOpen(false);
    setSearchQuery('');
  }

  const fuseInstance = useMemo(() => buildDropdownFuse(options, fuse), [options, fuse]);

  const trimmedQuery = searchQuery.trim();

  const results = useMemo(() => {
    const matches = applyDropdownFilter(options, trimmedQuery, searchable, fuseInstance);
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

  const canClear = clearable && value != null;

  useEffect(() => {
    if (!open || isMobile) {
      setMenuAbove(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuAbove(window.innerHeight - rect.bottom < 220);
  }, [open, isMobile]);

  useEffect(() => {
    function handlePointerOutside(event: MouseEvent | TouchEvent) {
      if (isMobile) return;
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDropdown();
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
  }, [isMobile]);

  return (
    <div ref={rootRef} className="relative">
      {isMobile && open && (
        <MobileSelectSheet
          options={options}
          maxResults={maxResults}
          value={value}
          onChange={item => {
            onChange(item);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          placeholder={placeholder}
          searchable={searchable !== false}
          fuse={fuse}
          renderOption={renderOption}
          noResultsText={noResultsText}
          clearable={clearable}
          clearAriaLabel={clearAriaLabel}
          createOption={createOption}
        />
      )}
      <div className="relative">
        {searchable ? (
          <Input
            {...inputProps}
            value={displayValue}
            onChange={event => setSearchQuery(event.target.value)}
            onFocus={event => {
              inputProps?.onFocus?.(event);
              setSearchQuery('');
              setOpen(true);
            }}
            autoComplete={inputProps?.autoComplete ?? 'off'}
            autoCorrect={inputProps?.autoCorrect ?? 'off'}
            autoCapitalize={inputProps?.autoCapitalize ?? 'none'}
            spellCheck={inputProps?.spellCheck ?? false}
            placeholder={inputPlaceholder}
            variant="ghost"
            className={cn('w-full text-[15px]', canClear && 'pr-7', inputClassName)}
          />
        ) : (
          <Button
            type="button"
            variant="transparent"
            size="xs"
            onClick={() => setOpen(prev => !prev)}
            className={cn(
              'flex w-full cursor-pointer items-center justify-between gap-1 rounded-none p-0 text-left font-normal',
              canClear && 'pr-7',
              inputClassName,
            )}
          >
            <span className="truncate">
              {selectedLabel || <span className="text-[var(--fin-subtle)]">{placeholder}</span>}
            </span>
            <ChevronDownOutlineIcon
              className={cn(
                'ml-1 size-[10px] shrink-0 text-[var(--fin-subtle)] transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </Button>
        )}

        {canClear && (
          <Button
            type="button"
            variant="transparent"
            size="xs"
            aria-label={clearAriaLabel}
            title={clearAriaLabel}
            onMouseDown={event => {
              event.preventDefault();
              onChange(null);
              closeDropdown();
            }}
            className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded p-0 text-[var(--fin-red)] hover:bg-[var(--fin-red-d)]"
          >
            <XOutlineIcon className="size-3.5" />
          </Button>
        )}
      </div>

      {!isMobile && open && (results.length > 0 || showCreateOption || (trimmedQuery.length > 0 && noResultsText)) && (
        <div
          className={cn(
            'absolute left-0 right-0 z-20 max-h-[200px] overflow-y-auto rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] shadow-lg',
            menuAbove ? 'bottom-full mb-1' : 'top-full mt-1',
            menuClassName,
          )}
        >
          {results.map(item => (
            <Button
              key={item.id}
              type="button"
              variant="transparent"
              size="xs"
              onMouseDown={event => {
                event.preventDefault();
                onChange(item);
                setSearchQuery('');
                if (closeOnChange) {
                  setOpen(false);
                }
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-none px-3 py-[8px] text-left text-[13px] font-normal text-[var(--fin-text)] hover:bg-[var(--fin-card3)]',
                optionClassName,
              )}
            >
              {renderOption ? renderOption(item) : <span>{String(item.value)}</span>}
            </Button>
          ))}

          {results.length === 0 && trimmedQuery.length > 0 && noResultsText && (
            <div className="px-3 py-[8px] text-[12px] text-[var(--fin-subtle)]">{noResultsText}</div>
          )}

          {showCreateOption && createOption && (
            <Button
              type="button"
              variant="transparent"
              size="xs"
              onMouseDown={event => {
                event.preventDefault();
                createOption.onCreate(trimmedQuery);
                closeDropdown();
              }}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-none px-3 py-[8px] text-left text-[13px] font-normal text-[var(--fin-accent)] hover:bg-[var(--fin-card3)]',
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
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
