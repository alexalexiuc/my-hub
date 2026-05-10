export type Range = '30d' | '3m' | 'ytd';
export type SortKey = 'totalSpent' | 'txCount' | 'name';

export const PAYEE_RANGES: { key: Range; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'ytd', label: 'This year' },
];
