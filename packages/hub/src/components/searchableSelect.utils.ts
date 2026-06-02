import Fuse from 'fuse.js';

export type DropdownOption = {
  id: number | string;
  value: number | string;
};

export type SelectCreateOption = {
  onCreate: (query: string) => void;
  shouldShow?: (query: string, options: DropdownOption[]) => boolean;
  renderLabel?: (query: string) => React.ReactNode;
  className?: string;
};

export function buildDropdownFuse(
  options: DropdownOption[],
  config: boolean | { threshold: number } | undefined,
): Fuse<DropdownOption> | null {
  if (!config || options.length === 0) return null;
  const threshold = typeof config === 'object' ? config.threshold : 0.35;
  return new Fuse(options, { keys: ['value'], threshold });
}

export function applyDropdownFilter(
  options: DropdownOption[],
  trimmedQuery: string,
  searchable: boolean,
  fuseInstance: Fuse<DropdownOption> | null,
): DropdownOption[] {
  if (!searchable || !trimmedQuery) return options;
  if (fuseInstance) return fuseInstance.search(trimmedQuery).map(r => r.item);
  const lowered = trimmedQuery.toLowerCase();
  return options.filter(item => String(item.value).toLowerCase().includes(lowered));
}
