// Re-exports from shared searchableSelect.utils with finances-specific type aliases for backward compat.
export type { DropdownOption } from '@/components/searchableSelect.utils';
export type { SelectCreateOption as FinancialDropdownCreateOption } from '@/components/searchableSelect.utils';
export { buildDropdownFuse, applyDropdownFilter } from '@/components/searchableSelect.utils';
