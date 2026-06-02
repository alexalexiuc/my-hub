// Re-export wrapper — keeps existing finances imports working.
// New code should import SearchableSelect from '@/components'.
export { SearchableSelect as FinancialDropdown } from '@/components';
export type { SearchableSelectProps as FinancialDropdownProps } from '@/components';
export type { DropdownOption, FinancialDropdownCreateOption } from './financialDropdown.utils';
export { buildDropdownFuse, applyDropdownFilter } from './financialDropdown.utils';
