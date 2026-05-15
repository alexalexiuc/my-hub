import { AccountTypes, LentDirections } from '@my-hub/shared/constants';

export const ACCOUNT_TYPE_OPTIONS = [
  { id: AccountTypes.Bank, value: '🏦 Bank' },
  { id: AccountTypes.Investment, value: '📈 Investment' },
  { id: AccountTypes.CreditCard, value: '💳 Credit Card' },
  { id: AccountTypes.Loan, value: '🏷 Loan' },
  { id: AccountTypes.Goal, value: '🎯 Goal' },
  { id: AccountTypes.Cash, value: '💵 Cash' },
  { id: AccountTypes.Tracking, value: '👁 Tracking' },
  { id: AccountTypes.BorrowedLent, value: '🤝 Borrowed / Lent' },
];

export const DIRECTION_OPTIONS = [
  { id: LentDirections.Gave, value: 'Lent (gave)' },
  { id: LentDirections.Received, value: 'Borrowed (received)' },
];
